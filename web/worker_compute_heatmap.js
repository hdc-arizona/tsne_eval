importScripts('lib/d3.js');

var xArray;
var yArray;
var xDomain = [1e100, -1e100];

dispatch = {
    setXArray: function(e) {
        xArray = new Float32Array(e.data.x.length);
        yArray = new Float32Array(e.data.x.length);
        for (var i=0; i<yArray.length; ++i) {
            xArray[i] = Math.sqrt(e.data.x[i]);
            xDomain[0] = Math.min(xDomain[0], xArray[i]);
            xDomain[1] = Math.max(xDomain[1], xArray[i]);
        }
    },
    compute: function(e) {
        var data = e.data.data;
        var min = 1e100, max = -1e100, lowDFrob = 0;
        for (var i=0; i<data.length; ++i) {
            var di = data[i];
            var x1 = di[0], y1 = di[1];
            for (var j=0; j<data.length; ++j) {
                var dj = data[j];
                var x2 = dj[0], y2 = dj[1];
                var dx = x2 - x1, dy = y2 - y1;
                var d2 = dx * dx + dy * dy, d = Math.sqrt(d2);
                lowDFrob += d2;
                yArray[i*data.length+j] = d;
                min = Math.min(min, d);
                max = Math.max(max, d);
            }
        }
        var xScale = d3.scale.linear().domain(xDomain).range(e.data.xRange);
        var yScale = d3.scale.linear().domain([min, max]).range([e.data.yRange[1]-0.01, e.data.yRange[0]]).clamp(true); // uuugly
        var dx = e.data.xRange[1] - e.data.xRange[0],
            dy = e.data.yRange[1] - e.data.yRange[0];
        var output = new Float32Array(dx * dy);
        max = 0;
        for (i=0; i<xArray.length; ++i) {
            var xp = ~~xScale(xArray[i]), yp = ~~yScale(yArray[i]);
            max = Math.max(max, ++output[xp + yp * dx]);
        }
        return {
            max: max, 
            dx: dx, dy: dy, frob: lowDFrob, 
            yDomain: yScale.domain(), 
            data: output
        };
    }
};

onmessage = function(e) {
    var result = dispatch[e.data.call](e);
    if (result !== undefined) {
        if (e.data._uuid) {
            result._uuid_dispatch = e.data._uuid;
        }
        postMessage(result);
    }
};
