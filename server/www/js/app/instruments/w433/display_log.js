/**
 * (c) 2015 Edouard Lafargue, ed@lafargue.name
 *
 * This file is part of Wizkers.
 *
 * Wizkers is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Wizkers is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Wizkers.  If not, see <http://www.gnu.org/licenses/>.
 */

/*
 * Log view for the W433.
 * 
 * Our model is a collection of Logs
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */

define(function(require) {
    "use strict";
    
    var $       = require('jquery'),
        _       = require('underscore'),
        Backbone = require('backbone'),
        tpl     = require('text!tpl/instruments/W433LogView.html'),
                template = null;
    
        try {
            template =  _.template(tpl);
        } catch (e) {
            // Will happen if we are packaged in a Chrome app
            console.log('W433Settings View: using compiled version (chrome app)');
            template = require('js/tpl/instruments/W433LogView.js');
        }
    
    // Load the flot library & flot time plugin:
    require('flot');
    require('flot_time');
    require('flot_selection');

    return  Backbone.View.extend({

        initialize:function () {
            var self = this;

            this.deviceLogs = this.collection;
            this.packedData = null;

            // Need this to make sure "render" will always be bound to our context.
            // -> required for the _.after below.
            _.bindAll(this,"render");

            // Now fetch all the contents, then render
            var renderGraph = _.after(this.deviceLogs.length, this.render);
            this.deviceLogs.each(function(log) {
                log.entries.fetch({success: renderGraph,
                                  xhr: function() {
                                        var xhr = $.ajaxSettings.xhr();
                                        xhr.onprogress = self.handleProgress;
                                        return xhr;
                                    }});
            });


            // TODO: save color palette in settings ?
            // My own nice color palette:
            this.palette = ["#e27c48", "#5a3037", "#f1ca4f", "#acbe80", "#77b1a7", "#858485", "#d9c7ad" ];


            this.plotOptions = {
                xaxis: { mode: "time", show:true,
                        timezone: settings.get("timezone"),                  
                       },
                grid: {
                    hoverable: true,
                    clickable: true
                },
                legend: { position: "ne" },
                selection: {
                    mode: "xy"
                },

                colors: this.palette,
            };        

            this.overviewOptions = {
                legend: { show: false },
                xaxis: { mode: "time", show:false, ticks:4 },
                yaxis: { ticks:4 },
                selection: { mode: "xy" },
                colors: this.palette,
            };  
            
            this.previousPoint = null;

        },

        handleProgress: function(e) {
                $('#loadtext').html("Loaded: " + e.loaded + " bytes");
        },


        events: {
            "click .resetZoom": "resetZoom",
        },


        resetZoom: function() {
            delete this.ranges;
            this.addPlot();
            return false;
        },

        render:function () {
            var self = this;
            console.log('Main render of Log management view');

            $(this.el).html(template());

            if (this.packedData == null || this.packedData.length==0)
                this.packedData = this.packData();

            if (this.packedData.length == 0)
                return;

            this.addPlot();

            return this;
        },

        onClose: function() {
            console.log("Log management view closing...");

        },

        // Generate a "blob:"  URL to download (all) the data;
        saveDataUrl: function() {
            return;
        },


        // We can only add the plot once the view has finished rendering and its el is
        // attached to the DOM, so this function has to be called from the home view.
        addPlot: function() {
            var self=this;

            if (this.deviceLogs == null || this.deviceLogs.length == 0)
                return;

            $('#log_size',this.el).html(this.deviceLogs.getOverallLength());
            $('#log_start',this.el).html(new Date(this.deviceLogs.getLogsStart()).toString());
            $('#log_end',this.el).html(new Date(this.deviceLogs.getLogsEnd()).toString());


            // Restore current zoom level if it exists:
            if (this.ranges) {
                this.plot = $.plot($(".locochart",this.el), this.packedData,
                    $.extend(true, {}, this.plotOptions, {
                        xaxis: { min: this.ranges.xaxis.from, max: this.ranges.xaxis.to },
                        yaxis: { min: this.ranges.yaxis.from, max: this.ranges.yaxis.to }
                    })
                 );

            } else {
                this.plot = $.plot($(".locochart", this.el), this.packedData, this.plotOptions);
            };

            $(".locochart", this.el).bind("plothover", function (event, pos, item) {
                if (item) {
                    if (this.previousPoint != item.dataIndex) {
                        this.previousPoint = item.dataIndex;

                        $("#tooltip").remove();
                        var x = item.datapoint[0],
                        y = item.datapoint[1];

                        self.showTooltip(item.pageX, item.pageY,
                            "<small>" + ((settings.get('timezone') === 'UTC') ? 
                                            new Date(x).toUTCString() :
                                            new Date(x).toString()) + "</small><br>" + item.series.label + ": <strong>" + y + "</strong>");
                    }
                } else {
                    $("#tooltip").remove();
                    this.previousPoint = null;            
                }
            });

            // Create the overview chart:
            this.overview = $.plot($("#overview",this.el), this.packedData, this.overviewOptions);

            // Connect overview and main charts
            $(".locochart",this.el).bind("plotselected", function (event, ranges) {

                // clamp the zooming to prevent eternal zoom

                if (ranges.xaxis.to - ranges.xaxis.from < 0.00001) {
                    ranges.xaxis.to = ranges.xaxis.from + 0.00001;
                }

                if (ranges.yaxis.to - ranges.yaxis.from < 0.00001) {
                    ranges.yaxis.to = ranges.yaxis.from + 0.00001;
                }

                // Save the current range so that switching plot scale (log/linear)
                // can preserve the zoom level:
                self.ranges = ranges;

                // do the zooming
                this.plot = $.plot($(".locochart",this.el), self.packedData,
                    $.extend(true, {}, self.plotOptions, {
                        xaxis: { min: ranges.xaxis.from, max: ranges.xaxis.to },
                        yaxis: { min: ranges.yaxis.from, max: ranges.yaxis.to }
                    })
                 );

                // don't fire event on the overview to prevent eternal loop
                self.overview.setSelection(ranges, true);
            });

            $("#overview",this.el).bind("plotselected", function (event, ranges) {
                 self.plot.setSelection(ranges);
              });

            // Last, update the save data URL to point to the data we just displayed:
            this.saveDataUrl();

        },


        // Depending on log type, we need to pack our data differently...
        packData: function() {
            var self=this;
            // Create a table of Y values with the x values from our collection
            var sensorData = [];
            var sensors = [];
            var logs = this.deviceLogs;
            // At this stage we know the logs are already fetched, btw.
            for (var j=0; j<logs.length; j++) {
                var value = logs.at(j).entries;
                var type = logs.at(j).get('logtype');
                for (var i=0; i < value.length; i++) {
                    var data = value.at(i).get('data');
                    // Now add the current sensor
                    // TODO: upon release, just remove support for non-named sensors
                    var sensor = ((data.sensor_name == undefined) ? data.sensor_address : data.sensor_name) + " - " + data.reading_type;
                    if (sensors.indexOf(sensor) == -1) {
                        sensors.push(sensor);
                        sensorData.push([]);
                    }
                    var idx = sensors.indexOf(sensor);
                    sensorData[idx].push([new Date(value.at(i).get('timestamp')).getTime(), parseFloat(data.value)]);
                }
            }

            var plotData = [];
            // Now pack our live data:
            for (var i = 0; i < sensors.length; i++) {
                plotData.push( { data: sensorData[i],
                                                label: sensors[i]} );

            }
            return plotData;
        },

        // Ugly at this stage, just to make it work (from flotcharts.org examples)
        showTooltip: function (x, y, contents) {
                $("<div id='tooltip' class='well'>" + contents + "</div>").css({
                    position: "absolute",
                    display: "none",
                    top: y + 5,
                    left: x + 5,
                    padding: "3px",
                    opacity: 0.90
                }).appendTo("body").fadeIn(200);
        },

    });
});