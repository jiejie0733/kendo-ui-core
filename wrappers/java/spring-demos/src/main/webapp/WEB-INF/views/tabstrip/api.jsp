<%@page contentType="text/html; charset=UTF-8" pageEncoding="UTF-8" %>
<%@taglib prefix="kendo" uri="http://www.kendoui.com/jsp/tags"%>
<%@taglib prefix="demo" tagdir="/WEB-INF/tags"%>
<%@taglib prefix="c" uri="http://java.sun.com/jsp/jstl/core" %>

<demo:header />

 <div class="box wide">
     <div class="box-col">
         <h4>Select</h4>
         <ul class="options">
             <li>
                 <input type="text" value="0" id="tabIndex" class="k-textbox"/> <button class="selectTab k-button">Select</button>
             </li>
             
         </ul>
         
         <h4>Enable / Disable</h4>
         <ul class="options">
             <li>
                 <button class="toggleTab k-button">Enable/Disable Selected</button>
             </li>
         </ul>
     </div>
     <div class="box-col">
         <h4>Add / Remove</h4>
         <ul class="options">
             <li>
                 <button class="removeItem k-button">Remove Selected</button>
             </li>
             <li>
                 <input type="text" value="Item" id="appendText" class="k-textbox"/> <button class="appendItem k-button">Append</button>
             </li>
         </ul>
     </div>
     <div class="box-col">
         <h4>&nbsp;</h4>
         <ul class="options">
             <li>
                 <input type="text" value="Item" id="beforeText" class="k-textbox"/> <button class="beforeItem k-button">Insert Before</button>
             </li>
             <li>
                 <input type="text" value="Item" id="afterText" class="k-textbox"/> <button class="afterItem k-button">Insert After</button>
             </li>

         </ul>
     </div>
     </div>

     <div class="demo-section k-content">

<kendo:tabStrip name="tabstrip">
    <kendo:tabStrip-animation>
        <kendo:tabStrip-animation-open effects="fadeIn"/>
    </kendo:tabStrip-animation>
	<kendo:tabStrip-items>
	    <kendo:tabStrip-item text="Baseball" selected="true" imageUrl="${baseball}">
			<kendo:tabStrip-item-content>
	            Baseball is a bat-and-ball sport played between two teams of nine players each. The aim is to score runs by hitting a thrown ball with a bat and touching a series of four bases arranged at the corners of a ninety-foot diamond. Players on the batting team take turns hitting against the pitcher of the fielding team, which tries to stop them from scoring runs by getting hitters out in any of several ways. A player on the batting team can stop at any of the bases and later advance via a teammate's hit or other means. The teams switch between batting and fielding whenever the fielding team records three outs. One turn at bat for each team constitutes an inning and nine innings make up a professional game. The team with the most runs at the end of the game wins.
		    </kendo:tabStrip-item-content>    
	    </kendo:tabStrip-item>
        <kendo:tabStrip-item text="Golf" imageUrl="${golf}">
            <kendo:tabStrip-item-content>
                Golf is a precision club and ball sport, in which competing players (or golfers) use many types of clubs to hit balls into a series of holes on a golf course using the fewest number of strokes. It is one of the few ball games that does not require a standardized playing area. Instead, the game is played on golf courses, each of which features a unique design, although courses typically consist of either nine or 18 holes. Golf is defined, in the rules of golf, as playing a ball with a club from the teeing ground into the hole by a stroke or successive strokes in accordance with the Rules.
            </kendo:tabStrip-item-content>    
        </kendo:tabStrip-item>
        <kendo:tabStrip-item text="Swimming" imageUrl="${swimming}">
            <kendo:tabStrip-item-content>
                Swimming has been recorded since prehistoric times; the earliest recording of swimming dates back to Stone Age paintings from around 7,000 years ago. Written references date from 2000 BC. Some of the earliest references to swimming include the Gilgamesh, the Iliad, the Odyssey, the Bible, Beowulf, and other sagas. In 1578, Nikolaus Wynmann, a German professor of languages, wrote the first swimming book, The Swimmer or A Dialogue on the Art of Swimming (Der Schwimmer oder ein Zwiegespr�ch �ber die Schwimmkunst). Competitive swimming in Europe started around 1800, mostly using breaststroke.
            </kendo:tabStrip-item-content>    
        </kendo:tabStrip-item>
        <kendo:tabStrip-item text="Snowboarding" imageUrl="${snowboarding}">
            <kendo:tabStrip-item-content>
                Snowboarding is a sport that involves descending a slope that is covered with snow on a snowboard attached to a rider's feet using a special boot set onto a mounted binding. The development of snowboarding was inspired by skateboarding, sledding, surfing and skiing. It was developed in the U.S.A. in the 1960s to 1970s and became a Winter Olympic Sport in 1998.
            </kendo:tabStrip-item-content>    
        </kendo:tabStrip-item>
    </kendo:tabStrip-items>
</kendo:tabStrip>
</div>
<script>
    $(document).ready(function() {
    	var tabStrip = $("#tabstrip").data("kendoTabStrip");
    	
        var getItem = function (target) {
                var itemIndex = target[0].value;

                return tabStrip.tabGroup.children("li").eq(itemIndex);
            },
            select = function(e) {
                if (e.type != "keypress" || kendo.keys.ENTER == e.keyCode)
                    tabStrip.select(getItem($("#tabIndex")));
            },
            append = function (e) {
                if (e.type != "keypress" || kendo.keys.ENTER == e.keyCode)
                    tabStrip.append({
                        text: $("#appendText").val(),
                        content: "<br>"
                    });
            },
            before = function (e) {
                if (e.type != "keypress" || kendo.keys.ENTER == e.keyCode)
                    tabStrip.insertBefore({
                        text: $("#beforeText").val(),
                        content: "<br>"
                    }, tabStrip.select());
            },
            after = function (e) {
                if (e.type != "keypress" || kendo.keys.ENTER == e.keyCode)
                    tabStrip.insertAfter({
                        text: $("#afterText").val(),
                        content: "<br>"
                    }, tabStrip.select());
            };

        $(".toggleTab").click(function(e) {
            var tab = tabStrip.select();

            tabStrip.enable(tab, tab.hasClass("k-state-disabled"));
        });

        $(".removeItem").click( function (e) {
            var tab = tabStrip.select(),
                otherTab = tab.next();
            otherTab = otherTab.length ? otherTab : tab.prev();

            tabStrip.remove(tab);
            tabStrip.select(otherTab);
        });

        $(".selectTab").click(select);
        $("#tabIndex").keypress(select);

        $(".appendItem").click(append);
        $("#appendText").keypress(append);

        $(".beforeItem").click(before);
        $("#beforeText").keypress(before);

        $(".afterItem").click(after);
        $("#afterText").keypress(after);
    });
</script>
<style>
    .box .k-textbox {
        width: 80px;
    }
    .box-col .options {
        margin-bottom: 20px;
    }
    .box-col {
        margin-bottom: -20px;
    }
</style>

<demo:footer />