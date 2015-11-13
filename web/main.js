workerHelper = function(uri, handlers) {
    var w = new Worker(uri);
    var result_dispatcher = {};
    var uuid = 0;

    w.onmessage = function(e) {
        var data = e.data;
        if (data._uuid_dispatch !== undefined) {
            result_dispatcher[data._uuid_dispatch](data);
            result_dispatcher[data._uuid_dispatch] = null;
        } else {
            handlers[data.call](data);
        }
    };

    return function(key) {
        return function(params, k) {
            if (typeof params === "function" && k === undefined) {
                k = params;
                params = undefined;
            } else if (k === undefined) {
                k = function() {};
            }
            params = _.clone(params || {});
            params._uuid = "_uuid_" + (uuid++);
            params.call = key;
            result_dispatcher[params._uuid] = k;
            w.postMessage(params);
        };
    };
};

//////////////////////////////////////////////////////////////////////////////


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
    ctx = canvas.node().getContext("2d");

    //////////////////////////////////////////////////////////////////////////

    var computeHeatmap, setXArray;
    (function () {
        var w = workerHelper('worker_compute_heatmap.js');
        computeHeatmap = w("compute");
        setXArray = w("setXArray");
    })();

    //////////////////////////////////////////////////////////////////////////////

    d3.json("labels.json", function(error, json) {
        if (json !== null)
            labels = json;
    });

    var highD_dists, lowD_dists;
    var highDExtent;
    var highDFrob;
    Lux.Net.binary("D.raw", function(buf) {
        highD_dists = new Float32Array(buf);
        highDFrob = d3.sum(highD_dists);
        highDExtent = d3.extent(highD_dists, function(d) { return Math.sqrt(d); });
        highDScale.domain(highDExtent);
        svg2XAxisGroup.call(svg2XAxis);
        setXArray({ x: highD_dists });
    });

    function load() {
        d3.json("out.json", function(data) {
            var circles = svg.selectAll("circle");
            x.domain(d3.extent(data, xAccessor));
            y.domain(d3.extent(data, yAccessor));
            var lowDFrob = 0;
            if (highD_dists) {
                computeHeatmap({
                    call: "compute",
                    data: data,
                    xRange: [0, 40],
                    yRange: [0, 40]
                }, function(data) {
                    lowDScale2.domain(data.yDomain);
                    lowDScale.domain([
                        data.yDomain[0] * Math.sqrt(highDFrob / data.frob),
                        data.yDomain[1] * Math.sqrt(highDFrob / data.frob)]);
                    ruler.domain(data.yDomain);
                    svg2YAxisGroup.transition().call(svg2YAxis);
                    svg2YAxisGroupb.transition().call(svg2YAxisb);
                    svgXAxisGroup.transition().call(svgXAxis);
                    debugger;
                    var colorScale = d3.scale.pow().exponent(.3)
                        .domainSegmented([1, data.max], 8)
                        // .domain([1, Math.sqrt(data.max), data.max])
                        .range(colorbrewer.YlGnBu[9].slice(1));
                    var w = canvas.attr("width") / data.dx, h = canvas.attr("height") / data.dy;
                    ctx.clearRect(0, 0, canvas.attr("width"), canvas.attr("height"));
                    for (var i=0; i<data.dy; ++i) {
                        for (var j=0; j<data.dx; ++j) {
                            if (data.data[j + i * data.dy] !== 0) {
                                ctx.fillStyle = colorScale(data.data[j + i * data.dy]);
                                ctx.fillRect(j * w, i * h, w + 1, h + 1);
                            }
                        }
                    }
                });
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
