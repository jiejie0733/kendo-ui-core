(function(f, define){
    define([ "../kendo.core", "../kendo.color", "./runtime", "./validation", "./references" ], f);
})(function(){

(function(kendo) {
    if (kendo.support.browser.msie && kendo.support.browser.version < 9) {
        return;
    }

    var RangeRef = kendo.spreadsheet.RangeRef;
    var CellRef = kendo.spreadsheet.CellRef;
    var Range = kendo.spreadsheet.Range;

    var Selection = kendo.Class.extend({
        init: function(sheet) {
            this._sheet = sheet;
            this.selection = kendo.spreadsheet.FIRSTREF.toRangeRef();
            this.originalSelection = kendo.spreadsheet.FIRSTREF.toRangeRef();
            this._activeCell = kendo.spreadsheet.FIRSTREF.toRangeRef();
            this.originalActiveCell = kendo.spreadsheet.FIRSTREF;
        },

        currentSelectionRange: function() {
            return this.selection.rangeAt(this.selectionRangeIndex).toRangeRef();
        },

        currentOriginalNavigationRange: function() {
            return this.originalSelection.rangeAt(this.selectionRangeIndex).toRangeRef();
        },

        currentNavigationRange: function() {
            if (this.singleCellSelection()) {
                return this._sheet._sheetRef;
            } else {
                return this.selection.rangeAt(this.selectionRangeIndex).toRangeRef();
            }
        },

        nextNavigationRange: function() {
            if (!this.singleCellSelection()) {
                this.selectionRangeIndex = this.selection.nextRangeIndex(this.selectionRangeIndex);
            }

            return this.currentNavigationRange();
        },

        previousNavigationRange: function() {
            if (!this.singleCellSelection()) {
                this.selectionRangeIndex = this.selection.previousRangeIndex(this.selectionRangeIndex);
            }

            return this.currentNavigationRange();
        },

        activeCell: function(ref) {
            if (ref) {
                this.originalActiveCell = ref.first();
                this._activeCell = this._sheet.unionWithMerged(ref.toRangeRef());
                this._sheet.focus(ref);
                this._sheet.triggerChange({ activeCell: true, selection: true });
            }

            return this._activeCell;
        },

        select: function(ref, expanded, changeActiveCell) {
            if (ref) {
                if (ref.eq(this.originalSelection)) {
                    return;
                }

                this.originalSelection = ref;

                this.selection = expanded;

                if (changeActiveCell !== false) {

                    if (ref.isCell()) {
                        this.activeCell(ref);
                    } else {
                        this.activeCell(this.selection.lastRange().first());
                    }

                    this.selectionRangeIndex = this.selection.size() - 1;
                } else {
                    this._sheet.triggerChange({ selection: true });
                }
            }

            return this.selection;
        },

        singleCellSelection: function() {
            return this._activeCell.eq(this.selection);
        }
    });

    var Sheet = kendo.Observable.extend({
        init: function() {
            kendo.Observable.prototype.init.call(this);
            this._reinit.apply(this, arguments);
        },

        _reinit: function(rowCount, columnCount, rowHeight, columnWidth, headerHeight, headerWidth) {
            var cellCount = rowCount * columnCount - 1;

            this._rows = new kendo.spreadsheet.Axis(rowCount, rowHeight);
            this._columns = new kendo.spreadsheet.Axis(columnCount, columnWidth);
            this._mergedCells = [];
            this._frozenRows = 0;
            this._frozenColumns = 0;
            this._suspendChanges = false;
            this._filter = null;
            this._showGridLines = true;
            this._gridLinesColor = null;
            this._grid = new kendo.spreadsheet.Grid(this._rows, this._columns, rowCount, columnCount, headerHeight, headerWidth);
            this._sheetRef = this._grid.normalize(kendo.spreadsheet.SHEETREF);
            this._properties = new kendo.spreadsheet.PropertyBag(cellCount);
            this._sorter = new kendo.spreadsheet.Sorter(this._grid, this._properties.sortable());

            this._viewSelection = new Selection(this);

            this._editSelection = new Selection(this);

            this._formulaSelections = [];
       },

        _selectionState: function() {
            return this._inEdit ? this._editSelection : this._viewSelection;
        },

        navigator: function() {
            if(!this._navigator) {
                 this._navigator = new kendo.spreadsheet.SheetNavigator(this);
            }
            return this._navigator;
        },

        axisManager: function() {
            if(!this._axisManager) {
                 this._axisManager = new kendo.spreadsheet.AxisManager(this);
            }

            return this._axisManager;
        },

        _name: function(value) {
            if (!value) {
                return this._sheetName;
            }

            this._sheetName = value;

            return this;
        },

        name: function() {
            return this._name();
        },

        _property: function(accessor, value, reason) {
            if (value === undefined) {
                return accessor();
            } else {
                accessor(value);

                return this.triggerChange(reason);
            }
        },

        _field: function(name, value, reason) {
            if (value === undefined) {
                return this[name];
            } else {
                this[name] = value;

                return this.triggerChange(reason);
            }
        },

        suspendChanges: function(value) {
            if (value === undefined) {
                return this._suspendChanges;
            }

            this._suspendChanges = value;

            return this;
        },

        triggerChange: function(reason) {
            if (!this._suspendChanges) {
                this.trigger("change", reason);
            }
            return this;
        },

        setDataSource: function(dataSource, columns) {
            if (this.dataSourceBinder) {
                this.dataSourceBinder.destroy();
            }

            this.dataSourceBinder = new kendo.spreadsheet.SheetDataSourceBinder({
                dataSource: dataSource,
                sheet: this,
                columns: columns
            });

            this.dataSource = this.dataSourceBinder.dataSource;
        },

        hideColumn: function(columnIndex) {
            return this._property(this._columns.hide.bind(this._columns), columnIndex, { layout: true });
        },

        unhideColumn: function(columnIndex) {
            return this._property(this._columns.unhide.bind(this._columns), columnIndex, { layout: true });
        },

        isHiddenColumn: function(columnIndex) {
            return this._grid._columns.hidden(columnIndex);
        },

        _copyRange: function(sourceRangeRef, targetRef) {
            var grid = this._grid;
            var rowCount = grid.rowCount;

            var nextRefTopLeft = grid.normalize(sourceRangeRef.topLeft);
            var nextRefBottomRight = grid.normalize(sourceRangeRef.bottomRight);

            var nextIndex = nextRefTopLeft.col * rowCount + nextRefTopLeft.row;
            var nextBottomIndex = nextRefBottomRight.col * rowCount + nextRefBottomRight.row;

            var targetIndex = targetRef.col * rowCount + targetRef.row;

            this._properties.copy(nextIndex, nextBottomIndex, targetIndex);
        },

        _adjustReferences: function(operation, start, delta, mergedCells) {
            this._mergedCells = mergedCells.reduce(function(a, ref){
                ref = ref.adjust(null, null, null, null, operation == "row", start, delta);
                if (ref instanceof RangeRef) {
                    a.push(ref);
                }
                return a;
            }, []);
            if (this._workbook) {
                var affectedSheet = this._name();
                this._workbook._sheets.forEach(function(sheet){
                    sheet._forFormulas(function(formula){
                        formula.adjust(affectedSheet, operation, start, delta);
                    });

                    sheet._forValidations(function(validation){
                        validation.adjust(affectedSheet, operation, start, delta);
                    });
                });
                this._workbook.adjustNames(affectedSheet, operation == "row", start, delta);
            }
            var selection = this.select();
            selection = selection.adjust(null, null, null, null, operation == "row", start, delta);
            if (selection !== kendo.spreadsheet.NULLREF) {
                this.select(selection);
            }
            // adjust column widths or row heights and hidden attribute
            var axis = operation == "col" ? this._columns : this._rows;
            axis.adjust(start, delta);
        },

        _forFormulas: function(callback) {
            var props = this._properties;
            var formulas = props.get("formula").values();
            var n = formulas.length;
            formulas.forEach(function(f, i){
                callback.call(this, f.value, i, n);
            }, this);
        },

        _forValidations: function(callback) {
            var props = this._properties;
            props.get("validation").values().forEach(function(v){
                callback.call(this, v.value);
            }, this);
        },

        canInsertRow: function(rowIndex, count) {
            count = count || 1;
            var grid = this._grid;
            var range = this.range(grid.rowCount - count, 0, count, grid.columnCount);
            return !range.hasValue();
        },

        insertRow: function(rowIndex) {
            if (!this.canInsertRow(rowIndex)) {
                throw new Error("Shifting nonblank cells off the worksheet is not supported!");
            }

            this.batch(function() {

                var grid = this._grid;
                var columnCount = grid.columnCount;
                var rowCount = grid.rowCount;

                var frozenRows = this.frozenRows();

                if (rowIndex < frozenRows) {
                    this.frozenRows(frozenRows + 1);
                }

                var mergedCells = this._mergedCells.slice();

                for (var ci = 0; ci < columnCount; ci++) {
                    var ref = new RangeRef(new CellRef(rowIndex, ci), new CellRef(rowIndex, ci));

                    var topLeft = grid.normalize(ref.topLeft);
                    var bottomRight = grid.normalize(ref.bottomRight);

                    var nextRef = new RangeRef(
                        new CellRef(topLeft.row, topLeft.col),
                        new CellRef(rowCount - 2, bottomRight.col)
                    );

                    this._copyRange(nextRef, new CellRef(topLeft.row + 1, topLeft.col));

                    new Range(ref, this).clear();
                }

                this._adjustReferences("row", rowIndex, 1, mergedCells);
            }, {
                recalc: true,
                layout: true,
                insertRow: { index: rowIndex },
                ref: new RangeRef(new CellRef(rowIndex, 0), new CellRef(Infinity, Infinity))
            });

            this.trigger("insertRow", { index: rowIndex });

            return this;
        },

        isEnabledRow: function(rowIndex) {
            var ref = new RangeRef(new CellRef(rowIndex, 0), new CellRef(rowIndex, this._grid.columnCount));
            return new Range(ref, this).enable();
        },

        deleteRow: function(rowIndex) {
            if (!this.isEnabledRow(rowIndex)) {
                return this;
            }

            this.batch(function() {
                var grid = this._grid;
                var columnCount = grid.columnCount;

                var frozenRows = this.frozenRows();
                if (rowIndex < frozenRows) {
                    this.frozenRows(frozenRows - 1);
                }

                var mergedCells = this._mergedCells.slice();

                for (var ci = 0; ci < columnCount; ci++) {
                    var ref = new RangeRef(new CellRef(rowIndex, ci), new CellRef(rowIndex, ci));

                    new Range(ref, this).clear();

                    var topLeft = grid.normalize(ref.topLeft);
                    var bottomRight = grid.normalize(ref.bottomRight);

                    var nextRef = new RangeRef(
                        new CellRef(topLeft.row + 1, topLeft.col),
                        new CellRef(Infinity, bottomRight.col)
                    );

                    this._copyRange(nextRef, topLeft);

                    var nextRefBottomRight = grid.normalize(nextRef.bottomRight);

                    new Range(new RangeRef(nextRefBottomRight, nextRefBottomRight), this).clear();
                }

                this._adjustReferences("row", rowIndex, -1, mergedCells);
            }, {
                recalc: true,
                layout: true,
                deleteRow: { index: rowIndex },
                ref: new RangeRef(new CellRef(rowIndex, 0), new CellRef(Infinity, Infinity))
            });

            this.trigger("deleteRow", { index: rowIndex });

            return this;
        },

        insertColumn: function(columnIndex) {
            this.batch(function() {
                var grid = this._grid;
                var columnCount = grid.columnCount;

                var frozenColumns = this.frozenColumns();

                if (columnIndex < frozenColumns) {
                    this.frozenColumns(frozenColumns + 1);
                }

                var mergedCells = this._mergedCells.slice();

                for (var ci = columnCount; ci >= columnIndex; ci--) {
                    var ref = new RangeRef(new CellRef(0, ci), new CellRef(Infinity, ci));

                    new Range(ref, this).clear();

                    if (ci == columnIndex) {
                        break;
                    }

                    var topLeft = grid.normalize(ref.topLeft);
                    var bottomRight = grid.normalize(ref.bottomRight);

                    var nextRef = new RangeRef(
                        new CellRef(topLeft.row, topLeft.col - 1),
                        new CellRef(bottomRight.row, bottomRight.col - 1)
                    );

                    this._copyRange(nextRef, topLeft);
                }

                this._adjustReferences("col", columnIndex, 1, mergedCells);
            }, {
                recalc: true,
                layout: true,
                insertColumn: { index: columnIndex },
                ref: new RangeRef(new CellRef(0, columnIndex), new CellRef(Infinity, Infinity))
            });

            return this;
        },

        isEnabledColumn: function(columnIndex) {
            var ref = new RangeRef(new CellRef(0, columnIndex), new CellRef(Infinity, columnIndex));
            return new Range(ref, this).enable();
        },

        deleteColumn: function(columnIndex) {
            if (!this.isEnabledColumn(columnIndex)) {
                return this;
            }

            this.batch(function() {
                var grid = this._grid;
                var columnCount = grid.columnCount;

                var frozenColumns = this.frozenColumns();

                if (columnIndex < frozenColumns) {
                    this.frozenColumns(frozenColumns - 1);
                }

                var mergedCells = this._mergedCells.slice();

                for (var ci = columnIndex; ci < columnCount; ci++) {
                    var ref = new RangeRef(new CellRef(0, ci), new CellRef(Infinity, ci));

                    new Range(ref, this).clear();

                    if (ci == columnCount - 1) {
                        break;
                    }

                    var topLeft = grid.normalize(ref.topLeft);
                    var bottomRight = grid.normalize(ref.bottomRight);

                    var nextRef = new RangeRef(
                        new CellRef(topLeft.row, topLeft.col + 1),
                        new CellRef(bottomRight.row, bottomRight.col + 1)
                    );

                    this._copyRange(nextRef, topLeft);
                }

                this._adjustReferences("col", columnIndex, -1, mergedCells);
            }, {
                recalc: true,
                layout: true,
                deleteColumn: { index: columnIndex },
                ref: new RangeRef(new CellRef(0, columnIndex), new CellRef(Infinity, Infinity))
            });

            return this;
        },

        hideRow: function(rowIndex) {
            return this._property(this._rows.hide.bind(this._rows), rowIndex, { layout: true });
        },

        unhideRow: function(rowIndex) {
            return this._property(this._rows.unhide.bind(this._rows), rowIndex, { layout: true });
        },

        isHiddenRow: function(rowIndex) {
            return this._grid._rows.hidden(rowIndex);
        },

        columnWidth: function(columnIndex, width) {
            return this._property(this._columns.value.bind(this._columns, columnIndex, columnIndex), width, { layout: true });
        },

        rowHeight: function(rowIndex, height) {
            return this._property(this._rows.value.bind(this._rows, rowIndex, rowIndex), height, { layout: true });
        },

        frozenRows: function(value) {
            return this._field("_frozenRows", value, { layout: true });
        },

        frozenColumns: function(value) {
            return this._field("_frozenColumns", value, { layout: true });
        },

        showGridLines: function(value) {
            return this._field("_showGridLines", value, { layout: true });
        },

        gridLinesColor: function(value) {
            return this._field("_gridLinesColor", value, { layout: true });
        },

        _ref: function(row, column, numRows, numColumns) {
            var ref = null;

            if (row instanceof kendo.spreadsheet.Ref) {
                return row;
            }

            if (row instanceof kendo.spreadsheet.Range) {
                return row._ref.toRangeRef();
            }

            if (typeof row === "string") {
                ref = kendo.spreadsheet.calc.parseReference(row);
            } else {
                if (!numRows) {
                    numRows = 1;
                }

                if (!numColumns) {
                    numColumns = 1;
                }
                ref = new RangeRef(new CellRef(row, column), new CellRef(row + numRows - 1, column + numColumns - 1));
            }

            return ref;
        },

        range: function(row, column, numRows, numColumns) {
            return new Range(this._ref(row, column, numRows, numColumns), this);
        },

        forEachMergedCell: function(ref, callback) {
            var selectAll = false;

            if (typeof callback === "undefined") {
                callback = ref;
                selectAll = true;
            }

            this._mergedCells.forEach(function(merged) {
                if (selectAll || merged.intersects(ref)) {
                    callback(merged);
                }
            });
        },

        forEachFilterHeader: function(ref, callback) {
            var selectAll = false;

            if (typeof callback === "undefined") {
                callback = ref;
                selectAll = true;
            }

            if (this._filter) {
                var refs = [];

                // get refs of all columns
                this._filter.ref.forEachColumn(function(columnRef) {
                    if (selectAll || columnRef.intersects(ref)) {
                        refs.push(columnRef.topLeft);
                    }
                });

                // filter out merged references
                this._mergedCells.forEach(function(merged) {
                    refs = refs.map(function(ref) {
                        if (merged.intersects(ref)) {
                            return merged;
                        }

                        return ref;
                    });
                });

                // use only unique refs
                refs.reduce(function unique(result, element) {
                    if (result.indexOf(element) < 0) {
                        result.push(element);
                    }

                    return result;
                }, []).forEach(callback);
            }
        },

        forEach: function(ref, callback) {
            if (!(ref instanceof RangeRef)) {
                ref = this._ref(ref);
            }
            var topLeft = this._grid.normalize(ref.topLeft);
            var bottomRight = this._grid.normalize(ref.bottomRight);

            for (var ci = topLeft.col; ci <= bottomRight.col; ci ++) {
                var ri = topLeft.row;

                var startCellIndex = this._grid.index(ri, ci);
                var endCellIndex = this._grid.index(bottomRight.row, ci);

                /* jshint loopfunc: true */
                this._properties.forEach(startCellIndex, endCellIndex, function(value) {
                    callback(ri++, ci, value);
                });
            }
        },

        startResizing: function(initialPosition) {
            this._initialPosition = initialPosition;
            this._resizeInProgress = true;
        },

        startAutoFill: function() {
            this._autoFillInProgress = true;
            var selection = this.select();
            this._autoFillOrigin = selection;
            this._autoFillDest = selection;
            this.triggerChange({ selection: true });
        },

        updateAutoFill: function(dest, punch, hint, direction) {
            this._autoFillDest = dest;
            this._autoFillPunch = punch;
            this._autoFillHint = hint;
            this._autoFillDirection = direction;
            this.triggerChange({ selection: true });
        },

        autoFillRef: function() {
            return this._autoFillDest;
        },

        autoFillPunch: function() {
            return this._autoFillPunch;
        },

        autoFillInProgress: function() {
            return this._autoFillInProgress;
        },

        resizingInProgress: function() {
            return this._resizeInProgress;
        },

        completeResizing: function() {
            if (this._resizeInProgress) {
                this._resizeInProgress = false;
                var hintPosition = this.resizeHintPosition();

                if (this._initialPosition && hintPosition) {
                    var handlePosition = this.resizeHandlePosition();
                    if (handlePosition.col !== -Infinity) {
                        this.trigger("commandRequest", {
                            command: "ColumnWidthCommand",
                            options: {
                                target: handlePosition.col,
                                value: this.columnWidth(handlePosition.col) - (this._initialPosition.x - hintPosition.x)
                            }
                        });
                    } else {
                        this.trigger("commandRequest", {
                            command: "RowHeightCommand",
                            options: {
                                target: handlePosition.row,
                                value: this.rowHeight(handlePosition.row) - (this._initialPosition.y - hintPosition.y)
                            }
                        });
                    }
                } else {
                    this.trigger("change", { resize: true });
                }
            }
        },

        resizeHandlePosition: function() {
            return this._resizeHandlePosition;
        },

        resizeHintPosition: function(location) {
            if (location !== undefined) {
                this._resizeHintPosition = location;
                this.trigger("change", { resize: true });
            }
            return this._resizeHintPosition;
        },

        removeResizeHandle: function() {
            if (this._resizeHandlePosition) {
                this._resizeHintPosition = undefined;
                this._resizeHandlePosition = undefined;
                this._initialPosition = undefined;
                this.trigger("change", { resize: true });
            }
        },

        positionResizeHandle: function(ref) {
            this._resizeHandlePosition = ref;
            this.trigger("change", { resize: true });
        },

        startSelection: function() {
            this._selectionInProgress = true;
        },

        completeSelection: function() {
            if (this._selectionInProgress) {
                this._selectionInProgress = false;
                this._resizeHintPosition = undefined;
                this.trigger("change", { selection: true });
            }
            if (this._autoFillInProgress) {
                this._autoFillInProgress = false;
                var dest = this._autoFillDest;
                var origin = this._autoFillOrigin;

                if (this._autoFillPunch) { // we just clear data here
                    this.trigger("commandRequest", {
                        command: "ClearContentCommand", options: { operatingRange: this.range(this._autoFillPunch) }
                    });
                } else {
                    if (!dest.eq(origin)) {
                        this.trigger("commandRequest", {
                            command: "AutoFillCommand", options: { operatingRange: this.range(dest), origin: this.range(origin) }
                        });
                    } else {
                        this.triggerChange({ selection: true });
                    }
                }

                this._autoFillDest = null;
                this._autoFillPunch = null;
                this._autoFillOrigin = null;

                this.select(dest);
            }
        },

        selectionInProgress: function() {
            return this._selectionInProgress;
        },

        select: function(ref, changeActiveCell) {
            var selectionState = this._selectionState();

            var expandedRef;

            if (ref) {
                ref = this._ref(ref);
                expandedRef = this._grid.isAxis(ref) ? ref : this.unionWithMerged(ref);
            }

            return selectionState.select(ref, expandedRef, changeActiveCell);
        },

        originalSelect: function() {
            return this._selectionState().originalSelection;
        },

        currentSelectionRange: function() {
            return this._selectionState().currentSelectionRange();
        },

        currentOriginalSelectionRange: function() {
            return this._selectionState().currentOriginalNavigationRange();
        },

        currentNavigationRange: function() {
            return this._selectionState().currentNavigationRange();
        },

        nextNavigationRange: function() {
            return this._selectionState().nextNavigationRange();
        },

        previousNavigationRange: function() {
            return this._selectionState().previousNavigationRange();
        },

        selectionRangeIndex: function() {
            return this._selectionState().selectionRangeIndex;
        },

        activeCell: function(ref) {
            return this._selectionState().activeCell(ref);
        },

        originalActiveCell: function() {
            return this._selectionState().originalActiveCell;
        },

        singleCellSelection: function() {
            return this._selectionState().singleCellSelection();
        },

        unionWithMerged: function(ref) {
            var mergedCells = this._mergedCells;

            return ref.map(function(ref) {
                return ref.toRangeRef().union(mergedCells);
            });
        },

        trim: function(ref) {
            var trims = [];
            var grid = this._grid;
            this._properties.forEachProperty(function(property) {
                trims.push(grid.trim(ref, property.list));
            });
            return this.unionWithMerged(ref.topLeft.toRangeRef().union(trims));
        },

        focus: function(ref) {
            if (ref) {
                this._focus = ref.toRangeRef();
            } else {
                var focus = this._focus;
                this._focus = null;
                return focus;
            }
        },

        activeCellSelection: function() {
            return new Range(this._grid.normalize(this.activeCell()), this);
        },

        selection: function() {
            return new Range(this._grid.normalize(this._selectionState().selection), this);
        },

        selectedHeaders: function() {
            var selection = this.select();

            var rows = {};
            var cols = {};
            var allCols = false;
            var allRows = false;

            selection.forEach(function(ref) {
                var i;
                var rowState = "partial";
                var colState = "partial";
                ref = ref.toRangeRef();

                var bottomRight = ref.bottomRight;

                var rowSelection = bottomRight.col === Infinity;
                var colSelection = bottomRight.row === Infinity;

                if (colSelection) { //column selection
                    allRows = true;
                    colState = "full";
                }

                if (rowSelection) { //row selection
                    allCols = true;
                    rowState = "full";
                }

                if (!colSelection) { //column selection
                    for (i = ref.topLeft.row; i <= bottomRight.row; i++) {
                        if (rows[i] !== "full") {
                            rows[i] = rowState;
                        }
                    }
                }

                if (!rowSelection) {
                    for (i = ref.topLeft.col; i <= bottomRight.col; i++) {
                        if (cols[i] !== "full") {
                            cols[i] = colState;
                        }
                    }
                }
            });

            return {
                rows: rows,
                cols: cols,
                allRows: allRows,
                allCols: allCols,
                all: allRows && allCols
            };
        },

        isInEditMode: function(isInEdit) {
            if (isInEdit === undefined) {
                return this._inEdit;
            }

            this._inEdit = isInEdit;

            if (isInEdit) {
                this._editSelection.selection = this._viewSelection.selection.clone();
                this._editSelection.originalSelection = this._viewSelection.originalSelection.clone();
                this._editSelection._activeCell = this._viewSelection._activeCell.clone();
                this._editSelection.originalActiveCell = this._viewSelection.originalActiveCell.clone();
            }
        },

        _setFormulaSelections: function(selection) {
            this._formulaSelections = (selection || []).slice();
            this.triggerChange({ selection: true });
        },

        _viewActiveCell: function() {
            return this._viewSelection._activeCell.toRangeRef();
        },

        toJSON: function() {
            var positions = {};

            var rows = this._rows.toJSON("height", positions);
            var columns = this._columns.toJSON("width", {});
            var viewSelection = this._viewSelection;
            var hyperlinks = [];

            this.forEach(kendo.spreadsheet.SHEETREF, function(row, col, cell) {
                if (Object.keys(cell).length === 0) {
                    return;
                }

                if (cell.link) {
                    hyperlinks.push({
                        ref    : kendo.spreadsheet.Ref.display(null, row, col),
                        target : cell.link
                    });
                }

                var position = positions[row];

                if (position === undefined) {
                    position = rows.length;

                    rows.push({ index: row });

                    positions[row] = position;
                }

                row = rows[position];

                cell.index = col;

                if (row.cells === undefined) {
                    row.cells = [];
                }

                if (cell.formula) {
                    // stringify Formula object.
                    cell.formula = cell.formula.toString();
                }

                if (cell.validation) {
                    cell.validation = cell.validation.toJSON();
                }

                if (cell.color) {
                    cell.color = kendo.parseColor(cell.color).toCss();
                }

                if (cell.background) {
                    cell.background = kendo.parseColor(cell.background).toCss();
                }

                if (cell.borderTop && cell.borderTop.color) {
                    cell.borderTop.color = kendo.parseColor(cell.borderTop.color).toCss();
                }

                if (cell.borderBottom && cell.borderBottom.color) {
                    cell.borderBottom.color = kendo.parseColor(cell.borderBottom.color).toCss();
                }

                if (cell.borderRight && cell.borderRight.color) {
                    cell.borderRight.color = kendo.parseColor(cell.borderRight.color).toCss();
                }

                if (cell.borderLeft && cell.borderLeft.color) {
                    cell.borderLeft.color = kendo.parseColor(cell.borderLeft.color).toCss();
                }

                row.cells.push(cell);
            });

            var json = {
                name: this._name(),
                rows: rows,
                columns: columns,
                selection: viewSelection.selection.toString(),
                activeCell: viewSelection.activeCell().toString(),
                frozenRows: this.frozenRows(),
                frozenColumns: this.frozenColumns(),
                showGridLines: this.showGridLines(),
                gridLinesColor: this.gridLinesColor(),
                mergedCells: this._mergedCells.map(function(ref) {
                    return ref.toString();
                }),
                hyperlinks: hyperlinks
            };

            if (this._sort) {
               json.sort = {
                   ref: this._sort.ref.toString(),
                   columns: this._sort.columns.map(function(column) {
                       return {
                           index: column.index,
                           ascending: column.ascending
                       };
                   })
               };
            }

            if (this._filter) {
               json.filter = {
                   ref: this._filter.ref.toString(),
                   columns: this._filter.columns.map(function(column) {
                        var filter = column.filter.toJSON();
                        filter.index = column.index;
                        return filter;
                   })
               };
            }

            return json;
        },

        fromJSON: function(json) {
            this.batch(function() {
                if (json.name !== undefined) {
                    this._name(json.name);
                }

                if (json.frozenColumns !== undefined) {
                    this.frozenColumns(json.frozenColumns);
                }

                if (json.frozenRows !== undefined) {
                    this.frozenRows(json.frozenRows);
                }

                if (json.columns !== undefined) {
                    this._columns.fromJSON("width", json.columns);
                }

                if (json.rows !== undefined) {
                    this._rows.fromJSON("height", json.rows);

                    for (var ri = 0; ri < json.rows.length; ri++) {
                        var row = json.rows[ri];
                        var rowIndex = row.index;

                        if (rowIndex === undefined) {
                            rowIndex = ri;
                        }

                        if (row.cells) {
                            for (var ci = 0; ci < row.cells.length; ci++) {
                                var cell = row.cells[ci];
                                var columnIndex = cell.index;

                                if (columnIndex === undefined) {
                                    columnIndex = ci;
                                }

                                if (cell.formula) {
                                    cell.formula = this._compileFormula(rowIndex, columnIndex, cell.formula);
                                }

                                if (cell.validation) {
                                    cell.validation = this._compileValidation(rowIndex, columnIndex, cell.validation);
                                }

                                this._properties.fromJSON(this._grid.index(rowIndex, columnIndex), cell);
                            }
                        }
                    }
                }


                if (json.selection) {
                    this._viewSelection.selection =
                        this._viewSelection.originalSelection = this._ref(json.selection);
                }

                if (json.activeCell) {
                    var activeCellRef = this._ref(json.activeCell);

                    this._viewSelection._activeCell = activeCellRef.toRangeRef();
                    this._viewSelection.originalActiveCell = activeCellRef;
                }


                if (json.mergedCells) {
                    json.mergedCells.forEach(function(ref) {
                       this.range(ref).merge();
                    }, this);
                }

                if (json.sort) {
                    this._sort = {
                        ref: this._ref(json.sort.ref),
                        columns: json.sort.columns.slice(0)
                    };
                }

                if (json.filter) {
                    var ref = json.filter.ref;
                    var columns = json.filter.columns  === undefined ? [] : json.filter.columns;

                    if (!ref) {
                        kendo.logToConsole("Dropping filter for sheet '" + json.name + "' due to missing ref");
                    } else {
                        this._filter = {
                            ref: this._ref(ref),
                            columns: columns.map(function(column) {
                                return {
                                    index: column.index,
                                    filter: kendo.spreadsheet.Filter.create(column)
                                };
                            })
                        };

                        this._refreshFilter();
                    }
                }

                if (json.showGridLines !== undefined) {
                    this._showGridLines = json.showGridLines;
                }

                this._gridLinesColor = json.gridLinesColor;
            });

            this._rows._refresh();
            this._columns._refresh();
        },

        formula: function(ref) {
            return this._properties.get("formula", this._grid.cellRefIndex(ref));
        },

        validation: function(ref) {
            return this._properties.get("validation", this._grid.cellRefIndex(ref));
        },

        // NOTE: resetFormulas should be called first.  We don't do it in this
        // function because it should be done from the Workbook object for all
        // sheets.
        resetFormulas: function() {
            this._forFormulas(function(formula){
                formula.reset();
            });
        },

        resetValidations: function() {
            this._forValidations(function(validation){
                validation.reset();
            });
        },

        recalc: function(context, callback) {
            var formulas = this._properties.get("formula").values();
            var count = formulas.length, pending = 0, i = 0;
            if (!count && callback) {
                return callback();
            }
            function next() {
                pending--;
                if (i == count && !pending) {
                    callback();
                }
            }
            while (i < count) {
                pending++;
                formulas[i++].value.exec(context, callback ? next : null);
            }
        },

        revalidate: function(context) {
            var self = this;
            this._forValidations(function(validation){
                var cellRef = new CellRef(validation.row, validation.col);
                var ref =  new RangeRef(cellRef, cellRef);
                validation.exec(context, self._get(ref, "value"), self._get(ref, "format"));
            });
        },

        _value: function(row, col, value) {
            var index = this._grid.index(row, col);

            if (value !== undefined) {
                this._properties.set("value", index, index, value);
            } else {
                return this._properties.get("value", index);
            }
        },

        _validation: function(row, col) {
            var index = this._grid.index(row, col);

            return this._properties.get("validation", index);
        },

        _compileValidation: function(row, col, validation) {
            if (validation instanceof kendo.spreadsheet.validation.Validation) {
                // do not alter an existing object.
                return validation.clone(this._name(), row, col);
            }

            if (validation.from != null) { // jshint ignore: line
                validation.from = (validation.from + "").replace(/^=/, "");
            }

            if (validation.to != null) { // jshint ignore: line
                validation.to = (validation.to + "").replace(/^=/, "");
            }

            return kendo.spreadsheet.validation.compile(this._name(), row, col, validation);
        },

        _compileFormula: function(row, col, f) {
            f = f.replace(/^=/, "");
            f = kendo.spreadsheet.calc.parseFormula(this._name(), row, col, f);
            return kendo.spreadsheet.calc.compile(f);
        },

        _copyValuesInRange: function (topLeft, bottomRight, value, property) {
            var ci, start, end;

            for (ci = topLeft.col; ci <= bottomRight.col; ci++) {
                start = this._grid.index(topLeft.row, ci);
                end = this._grid.index(bottomRight.row, ci);
                for (var index = start, row = topLeft.row; index <= end; ++index, ++row) {
                    // Even if it's the same formula in multiple cells, we
                    // need to have different Formula objects, hence cloning
                    // it.  Don't worry, clone() is fast.
                    value = value.clone(this._name(), row, ci);
                    this._properties.set(property, index, index, value);
                }
            }
            return value;
        },

        _set: function(ref, name, value) {
            var topLeft = this._grid.normalize(ref.topLeft);
            var bottomRight = this._grid.normalize(ref.bottomRight);
            var ci, start, end;

            if (value && name == "formula") {
                if (typeof value == "string") {
                    // get Formula object.  we don't care about handling errors
                    // here since it won't be called interactively.
                    value = this._compileFormula(topLeft.row, topLeft.col, value);
                }

                value = this._copyValuesInRange(topLeft, bottomRight, value, "formula");

            } else if (value && name == "validation") {
                value = this._compileValidation(topLeft.row, topLeft.col, value);
                value = this._copyValuesInRange(topLeft, bottomRight, value, "validation");

            } else {
                for (ci = topLeft.col; ci <= bottomRight.col; ci++) {
                    start = this._grid.index(topLeft.row, ci);
                    end = this._grid.index(bottomRight.row, ci);
                    this._properties.set(name, start, end, value);
                    if (name == "formula") {
                        // removing a formula, must clear value.
                        this._properties.set("value", start, end, null);
                    }
                }
            }
        },

        _get: function(ref, name) {
            var topLeft = this._grid.normalize(ref.topLeft);

            var index = this._grid.index(topLeft.row, topLeft.col);

            return this._properties.get(name, index);
        },

        batch: function(callback, reason) {
            var suspended = this.suspendChanges();

            this.suspendChanges(true);

            callback.call(this);

            return this.suspendChanges(suspended).triggerChange(reason || { recalc: true });
        },

        _sortBy: function(ref, columns) {
            var indices = null;

            columns.forEach(function(column) {
                indices = this._sorter.sortBy(ref, column.index, this._properties.get("value"), column.ascending, indices);
            }, this);

            this._sort = {
                ref: ref,
                columns: columns
            };

            this._refreshFilter();

            this.triggerChange({ recalc: true });
        },

        _refreshFilter: function() {
            if (this._filter) {
                this._filterBy(this._filter.ref, this._filter.columns);
            }
        },

        _filterBy: function(ref, columns) {
            this.batch(function() {
                for (var ri = ref.topLeft.row; ri <= ref.bottomRight.row; ri++) {
                    if (this._rows.hidden(ri)) {
                        this._rows.unhide(ri);
                    }
                }

                columns.forEach(function(column) {
                    // do not filter header row
                    var columnRef = ref.resize({ top: 1 }).toColumn(column.index);

                    var cells = [];

                    if (columnRef === kendo.spreadsheet.NULLREF) {
                        return;
                    }

                    this.forEach(columnRef, function(row, col, cell) {
                        cell.row = row;
                        cells.push(cell);
                    });

                    column.filter.prepare(cells);

                    for (var ci = 0; ci < cells.length; ci++) {
                        var cell = cells[ci];
                        var value = column.filter.value(cell);

                        if (column.filter.matches(value) === false) {
                            this.hideRow(cell.row);
                        }
                    }
                }, this);

                this._filter = {
                    ref: ref,
                    columns: columns
                };
            }, { layout: true, filter: true });
        },

        filterColumn: function(ref) {
            var filterRef = this.filter().ref;
            return ref.toRangeRef().topLeft.col - filterRef.topLeft.col;
        },

        filter: function() {
            return this._filter;
        },

        clearFilter: function(spec) {
            this._clearFilter(spec instanceof Array ? spec : [spec]);
        },

        _clearFilter: function(indices) {
            if (this._filter) {
                this.batch(function() {
                    this._filter.columns = this._filter.columns.filter(function(column) {
                        return indices.indexOf(column.index) < 0;
                    });

                    this._refreshFilter();
                }, { layout: true, filter: true });
            }
        },

        getAxisState: function() {
            return {
                rows: this._rows.getState(),
                columns: this._columns.getState()
            };
        },

        setAxisState: function(state) {
            this._rows.setState(state.rows);
            this._columns.setState(state.columns);
            this.triggerChange({ layout: true });
        },

        getState: function() {
            return {
                rows: this._rows.getState(),
                columns: this._columns.getState(),
                mergedCells: this._mergedCells.map(function(cell) { return cell.clone(); }),
                properties: this._properties.getState()
            };
        },

        setState: function(state) {
            this._rows.setState(state.rows);
            this._columns.setState(state.columns);
            this._mergedCells = state.mergedCells;
            this._properties.setState(state.properties);
            this.triggerChange(kendo.spreadsheet.ALL_REASONS);
        },

        _merge: function(ref) {
            var mergedCells = this._mergedCells;

            var sheet = this;
            var mergedRef;
            this.batch(function() {
                mergedRef = ref.map(function(ref) {
                    if (ref instanceof kendo.spreadsheet.CellRef) {
                        return ref;
                    }

                    var currentRef = ref.toRangeRef().union(mergedCells, function(ref) {
                        mergedCells.splice(mergedCells.indexOf(ref), 1);
                    });

                    var range = new Range(currentRef, sheet);
                    var formula = range._get("formula");
                    var value = range.value();
                    var format = range.format();
                    var background = range.background();

                    range.value(null);
                    range.format(null);
                    range.background(null);

                    var topLeft = new Range(currentRef.collapse(), sheet);

                    if (formula) {
                        topLeft._set("formula", formula);
                    } else {
                        topLeft.value(value);
                    }
                    topLeft.format(format);
                    topLeft.background(background);

                    mergedCells.push(currentRef);
                    return currentRef;
                });

                var viewSelection = sheet._viewSelection;

                viewSelection.selection = sheet.unionWithMerged(viewSelection.originalSelection);
                viewSelection._activeCell = sheet.unionWithMerged(viewSelection.originalActiveCell);
            }, { activeCell: true, selection: true });

            return mergedRef;
        }
    });

    kendo.spreadsheet.Sheet = Sheet;
})(kendo);

}, typeof define == 'function' && define.amd ? define : function(a1, a2, a3){ (a3 || a2)(); });
