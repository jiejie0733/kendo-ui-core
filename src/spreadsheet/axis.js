(function(f, define){
    define([ "../kendo.core" ], f);
})(function(){

(function(kendo) {
    var Axis = kendo.Class.extend({
        init: function(count, value) {
            this.values = new kendo.spreadsheet.RangeList(0, count - 1, value, true);
            this.scrollBarSize = kendo.support.scrollbar();
            this._refresh();
        },

        value: function(start, end, value) {
            if (value !== undefined) {
                this.values.value(start, end, value);
                this._refresh();
            } else {
                return this.values.iterator(start, end).at(0);
            }
        },

        sum: function(start, end) {
            var values = this.values.iterator(start, end);

            var sum = 0;

            for (var idx = start; idx <= end; idx ++) {
                sum += values.at(idx);
            }

            return sum;
        },

        visible: function(start, end) {
            var startSegment = null;
            var endSegment = null;
            var lastPage = false;

            if (end >= this.total + this.scrollBarSize) {
                lastPage = true;
            }

            var ranges = this.pixelValues.intersecting(start, end);

            startSegment = ranges[0];
            endSegment = ranges[ranges.length - 1];

            var startOffset = start - startSegment.start;

            var startIndex = ((startOffset / startSegment.value.value) >> 0) + startSegment.value.start;

            var offset = startOffset - (startIndex - startSegment.value.start) * startSegment.value.value;

            var endOffset = end - endSegment.start;
            var endIndex = ((endOffset / endSegment.value.value) >> 0) + endSegment.value.start;

            if (endIndex > endSegment.value.end) {
                endIndex = endSegment.value.end;
            }

            if (lastPage) {
                offset += endSegment.value.value - (endOffset - (endIndex - endSegment.value.start) * endSegment.value.value);
            }

            offset = -offset;

            return {
                values: this.values.iterator(startIndex, endIndex),
                offset: offset
            };
        },

        _refresh: function() {
            var current = 0;
            this.pixelValues = this.values.map(function(range) {
                var start = current;
                current += (range.end - range.start + 1) * range.value;
                var end = current - 1;
                return new kendo.spreadsheet.ValueRange(start, end, range);
            });

            this.total = current;
        }
    });

    var PaneAxis = kendo.Class.extend({
        init: function(axis, start, count, headerSize) {
           this._axis = axis;
           this._start = start;
           this._count = count;
           this.hasHeader = start === 0;
           this.headerSize = headerSize;
           this.frozen = count > 0;
        },

        viewSize: function(viewSize) {
            this._viewSize = viewSize;
        },

        sum: function(start, end) {
            return this._axis.sum(start, end - 1);
        },

        start: function() {
            return this.sum(0, this._start);
        },

        size: function() {
            return this.sum(this._start, this._start + this._count);
        },

        //XXX: rename this method
        paneSegment: function() {
            var offset = this.start();
            var length;

            if (!this.hasHeader) {
                offset += this.headerSize;
            }

            if (this.frozen) {
                length = this.size();
                if (this.hasHeader) {
                    length += this.headerSize;
                } else {
                    length -= this.headerSize;
                }
            } else {
                length = this._viewSize - offset;
            }

            return {
                offset: offset,
                length: length
            };
        },

        visible: function(offset) {
            var start = this.start();
            var size;

            if (this.frozen) {
                size = this.size();
                if (!this.hasHeader) {
                    size -= this.headerSize;
                }
            } else {
                size = this._viewSize - start - this.headerSize;
                start += offset;
            }

            var result = this._axis.visible(start, start + size);

            if (this.frozen) {
                result.offset = 0;
            }

            result.start = start;

            if (this.hasHeader) {
                result.offset += this.headerSize;
                result.start -= this.headerSize;
            }

            return result;
        }
    });

    kendo.spreadsheet.Axis = Axis;
    kendo.spreadsheet.PaneAxis = PaneAxis;

})(kendo);
}, typeof define == 'function' && define.amd ? define : function(_, f){ f(); });
