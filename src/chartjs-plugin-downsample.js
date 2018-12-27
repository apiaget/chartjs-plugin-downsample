var Chart = require('chart.js');
Chart = typeof(Chart) === 'function' ? Chart : window.Chart;

var helpers = Chart.helpers;

var defaultOptions = {
    enabled: false,

    // max number of points to display per dataset
    threshold: 1000,

    // if true, downsamples data automatically every update
    auto: true,
    // if true, downsamples data when the chart is initialized
    onInit: true,

    // if true, replaces the downsampled data with the original data after each update
    restoreOriginalData: true,
    // if true, downsamples original data instead of data
    preferOriginalData: false,

};

var floor = Math.floor,
    abs = Math.abs;

function downsample(data, threshold) {
    // this function is from flot-downsample (MIT), with modifications

    var dataLength = data.length;

    if (threshold >= dataLength || threshold <= 0) {
        return data; // nothing to do
    }

    var sampled = [],
        sampledIndex = 0;

    // bucket size, leave room for start and end data points
    var every = (dataLength - 2) / (threshold - 2);

    var a = 0,  // initially a is the first point in the triangle
        maxAreaPoint,
        maxArea,
        area,
        nextA;

    // always add the first point
    sampled[sampledIndex++] = data[a];

    for (var i = 0; i < threshold - 2; i++) {
        // Calculate point average for next bucket (containing c)
        var avgX = 0,
            avgY = 0,
            avgRangeStart = floor(( i + 1 ) * every) + 1,
            avgRangeEnd = floor(( i + 2 ) * every) + 1;
        avgRangeEnd = avgRangeEnd < dataLength ? avgRangeEnd : dataLength;

        var avgRangeLength = avgRangeEnd - avgRangeStart;

        for (; avgRangeStart < avgRangeEnd; avgRangeStart++) {
            avgX += new Date(data[avgRangeStart].t).getTime() * 1; // * 1 enforces Number (value may be Date)
            avgY += data[avgRangeStart].y * 1;
        }
        avgX /= avgRangeLength;
        avgY /= avgRangeLength;

        // Get the range for this bucket
        var rangeOffs = floor((i + 0) * every) + 1,
            rangeTo = floor((i + 1) * every) + 1;

        // Point a
        var pointAX = new Date(data[a].t).getTime() * 1, // enforce Number (value may be Date)
            pointAY = data[a].y * 1;

        maxArea = area = -1;

        for (; rangeOffs < rangeTo; rangeOffs++) {
            // Calculate triangle area over three buckets
            area = abs(( pointAX - avgX ) * ( data[rangeOffs].y - pointAY ) -
                    ( pointAX - new Date(data[rangeOffs].t).getTime() ) * ( avgY - pointAY )
                ) * 0.5;
            if (area > maxArea) {
                maxArea = area;
                maxAreaPoint = data[rangeOffs];
                nextA = rangeOffs; // Next a is this b
            }
        }

        sampled[sampledIndex++] = maxAreaPoint; // Pick this point from the bucket
        a = nextA; // This a is the next a (chosen b)
    }

    sampled[sampledIndex] = data[dataLength - 1]; // Always add last

    return sampled;
}

function getOptions(chartInstance) {
    return chartInstance.options.downsample;
}

function downsampleChart(chartInstance) {
    var options = getOptions(chartInstance),
        threshold = options.threshold;
    if(!options.enabled) return;

    var datasets = chartInstance.data.datasets;
    if(chartInstance.scales === undefined) return;
    
    
    var min = chartInstance.scales['x-axis-0'].min;
    var min2 = chartInstance.config.options.scales.xAxes[0].time.min;
    var max = chartInstance.scales['x-axis-0'].max;
    var max2 = chartInstance.config.options.scales.xAxes[0].time.max;

    for(var i = 0; i < datasets.length; i++) {
        var dataset = datasets[i];

        var dataToDownsample = [];

        if(dataset.originalData === undefined || dataset.originalData === null)
            dataset.originalData = dataset.data;

        if(max-min === 86400000 || (min2 === undefined || max2 === undefined)) {
            dataToDownsample = dataset.originalData
        } else if (min2 !== undefined && max2 !== undefined && min2 === "" && max2 === "") { //reset
            dataToDownsample = dataset.originalData
        } else {
            if(min2 !== undefined && max2 !== undefined && min2 !== "" && max2 !== "") {
                min2 = new Date(min2).getTime();
                min = min2;
                max2 = new Date(max2).getTime();
                max = max2;
            }

            var timestamp = 0;
            for(var j = 0; j < dataset.originalData.length; j++) {
                timestamp = new Date(dataset.originalData[j].t).getTime();

                if(timestamp >= min && timestamp <= max) {
                    dataToDownsample.push(dataset.originalData[j]);
                }
            }
        }

        chartInstance.data.datasets[i].data = downsample(dataToDownsample, threshold);
    }
}

var downsamplePlugin = {
    beforeInit: function (chartInstance) {
        var options = chartInstance.options.downsample = helpers.extend({}, defaultOptions, chartInstance.options.downsample || {});
        if(options.onInit) {
            downsampleChart(chartInstance);
        }

        // allow manual downsample-triggering with chartInstance.downsample();
        chartInstance.downsample = function(threshold) {
            if(typeof(threshold) !== 'undefined') {
                chartInstance.options.downsample.threshold = threshold;
            }

            downsampleChart(chartInstance);
        }
    },

    beforeUpdate: function(chartInstance) {
        if(chartInstance.options.downsample.auto) {
            downsampleChart(chartInstance);
        }
    },

    /*beforeDatasetsUpdate: function(chartInstance) {
        if(chartInstance.options.downsample.auto) {
            console.log("beforeDatasetsUpdate");
            downsampleChart(chartInstance);
        }
    },*/
    
    afterDatasetsUpdate: function(chartInstance) {
        /*var options = getOptions(chartInstance);
        if(!options.enabled || !options.restoreOriginalData) return;
        
        var datasets = chartInstance.data.datasets;
        for(var i = 0; i < datasets.length; i++) {
            //console.log("afterDatasetsUpdate");
            //var dataset = datasets[i];
            //console.log(dataset.originalData || dataset.data);

            //dataset.data = dataset.data;
            //dataset.originalData = null;
        }*/
    }
};

module.exports = downsamplePlugin;
Chart.pluginService.register(downsamplePlugin);
