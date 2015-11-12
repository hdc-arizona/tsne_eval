function init()
{
    var svg = d3.select("#splot")
        .append("svg")
        .attr({width:500, height:500});
    var x = d3.scale.linear().range([20, 480]);
    var y = d3.scale.linear().range([480, 20]);
    var xAccessor = function(d) { return d[0]; };
    var yAccessor = function(d) { return d[1]; };
    var colors = d3.scale.category10();
    var labels;
    var ruler = d3.scale.linear().domain([0,460]).range([20, 480]);
    var svgXAxis = d3.svg.axis().scale(ruler);
    var svgXAxisGroup = svg.append("g").attr("transform", "translate(0, 475)").call(svgXAxis);

    var xMarginLeft = 70, xMarginRight = 20;
    var yMarginTop = 20, yMarginBottom = 30;
    var svg2 = d3.select("#dists")
        .append("svg").style("position", "absolute")
        .attr({width: 500, height: 500});
    var highDScale = d3.scale.linear().range([xMarginLeft, 500 - xMarginRight]);
    var lowDScale = d3.scale.linear().range([500 - yMarginBottom, yMarginTop]);
    var lowDScale2 = d3.scale.linear().range([500 - yMarginBottom, yMarginTop]);
    var svg2XAxis = d3.svg.axis().scale(highDScale), 
        svg2YAxis = d3.svg.axis().scale(lowDScale).orient("right"),
        svg2YAxisb = d3.svg.axis().scale(lowDScale2).orient("left")
    ;
    var svg2XAxisGroup = svg2.append("g").attr("transform", "translate(0," + (500 - yMarginBottom) + ")").call(svg2XAxis);
    var svg2YAxisGroup = svg2.append("g").attr("transform", "translate(" + xMarginLeft + ",0)").call(svg2YAxis);
    var svg2YAxisGroupb = svg2.append("g").attr("transform", "translate(" + xMarginLeft + ",0)").call(svg2YAxisb);

    var canvas = d3.select("#dists")
        .append("div").style("position", "absolute").style("left", xMarginLeft + "px").style("top", yMarginTop + "px")
        .append("canvas").attr({width: 500-xMarginLeft-xMarginRight, height:500-yMarginTop-yMarginBottom});
    var gl = Lux.init({
        canvas: canvas.node(),
        clearColor: [0,0,0,0.1]
    });

    d3.json("labels.json", function(error, json) {
        if (json !== null)
            labels = json;
    });

    var highD_dists, lowD_dists;
    var luxScatterplot, luxXScale, luxYScale;
    var luxYAttributeBuffer, 
        luxYMinParameter = Shade.parameter("float", -1), 
        luxYMaxParameter = Shade.parameter("float", 1);
    var highDExtent;
    var highDFrob;
    Lux.Net.binary("D.raw", function(buf) {
        highD_dists = new Float32Array(buf);
        highDFrob = d3.sum(highD_dists);
        highDExtent = d3.extent(highD_dists, function(d) { return Math.sqrt(d); });
        highDScale.domain(highDExtent);
        console.log(highDScale.domain());
        svg2XAxisGroup.call(svg2XAxis);
        lowD_dists = new Float32Array(highD_dists);
        debugger;
        luxXScale = Shade.Scale.linear({domain: highDScale.domain(), range: [0,1]});
        luxYScale = Shade.Scale.linear({
            domain: [luxYMinParameter, luxYMaxParameter], 
            range: [0, 1]
        });
        luxYAttributeBuffer = Lux.attributeBuffer({ vertexArray: lowD_dists, itemSize: 1, keepArray: false });
        luxScatterplot = Lux.Scene.add(Lux.Marks.scatterplot({
            elements: highD_dists.length,
            x: Shade.sqrt(Lux.attributeBuffer({ vertexArray: highD_dists, itemSize: 1, keepArray: false })),
            y: Shade.sqrt(luxYAttributeBuffer),
            xScale: luxXScale,
            yScale: luxYScale,
            fillColor: Shade.color("red", 0.01),
            strokeColor: Shade.color("red", 0.01),
            pointDiameter: 3,
            mode: Lux.DrawingMode.over
        }));
    });

    function load() {
        d3.json("out.json", function(data) {
            var circles = svg.selectAll("circle");
            x.domain(d3.extent(data, xAccessor));
            y.domain(d3.extent(data, yAccessor));
            var lowDFrob = 0;
            if (lowD_dists) {
                var min = 1e100, max = -1e100;
                for (var i=0; i<data.length; ++i) {
                    var di = data[i];
                    var x1 = xAccessor(di);
                    var y1 = yAccessor(di);
                    for (var j=0; j<data.length; ++j) {
                        var dj = data[j];
                        var x2 = xAccessor(dj);
                        var y2 = yAccessor(dj);
                        var dy = y2 - y1, dx = x2 - x1;
                        var d2 = dy * dy + dx * dx;
                        lowD_dists[i*data.length+j] = d2;
                        min = Math.min(min, d2);
                        max = Math.max(max, d2);
                        lowDFrob += d2;
                    }
                }
                lowDScale2.domain([Math.sqrt(min), Math.sqrt(max)]);
                ruler.domain([Math.sqrt(min), Math.sqrt(max)]);
                min *= highDFrob / lowDFrob;
                max *= highDFrob / lowDFrob;
                for (i=0; i<lowD_dists.length; ++i) {
                    lowD_dists[i] *= highDFrob / lowDFrob;
                }
                luxYAttributeBuffer.set(lowD_dists);
                lowDScale.domain([Math.sqrt(min), Math.sqrt(max)]);
                luxYMinParameter.set(Math.sqrt(min));
                luxYMaxParameter.set(Math.sqrt(max));
                Lux.Scene.invalidate();
                svg2YAxisGroup.transition().call(svg2YAxis);
                svg2YAxisGroupb.transition().call(svg2YAxisb);
                // highDScale.domain([highDExtent[0] / highDFrob * lowDFrob,
                //                    highDExtent[1] / highDFrob * lowDFrob]);
                svgXAxisGroup.transition().call(svgXAxis);
            }
            function setAttrs(sel) {
                sel.attr("cx", function(d) { return x(xAccessor(d)); })
                    .attr("cy", function(d) { return y(yAccessor(d)); });
                if (labels !== undefined) {
                    sel.attr("fill", function(d, i) { return colors(labels[i]); });
                }
                return sel;
            }
            var update = circles.data(data);
            update.transition().duration(500).call(setAttrs);
            var enter = update.enter().append("circle").attr("r", 5).attr("fill", "black").call(setAttrs);
            var exit = update.exit().remove();
        });
    }

    function do_it() {
        console.log("ping");
        _.delay(function() {
            load();
            do_it();
        }, 2000);
    }
    load();
    do_it();
}

init();
