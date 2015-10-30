/**
 * (c) 2015 Edouard Lafargue, ed@lafargue.name
 *
 * This file is part of Wizkers.
 *
 * Wizkers is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Wizkers is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Wizkers.  If not, see <http://www.gnu.org/licenses/>.
 */

/*
 * Live view for the Fried Circuits OLED backpack
 *
 * Our model is the settings object.
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */

define(function (require) {
    "use strict";

    var $ = require('jquery'),
        _ = require('underscore'),
        Backbone = require('backbone'),
        template = require('js/tpl/instruments/FCOledLogView.js');

    // Load the flot library & flot time plugin:
    require('flot');
    require('flot_time');
    require('flot_resize');
    require('flot_selection');
    require('flot_fillbetween');

    return Backbone.View.extend({

        initialize: function (options) {

            this.deviceLogs = this.collection;
            this.packedData = []; // Vmin,Vmax,Vavg, Amin,Amax,Aavg
            this.voltplot = null;
            this.ampplot = null;
            this.vpreviousPoint = null;
            this.apreviousPoint = null;

            // Need this to make sure "render" will always be bound to our context.
            // -> required for the _.after below.
            _.bindAll(this, "render");

            // Now fetch all the contents, then render
            var renderGraph = _.after(this.deviceLogs.length, this.render);
            this.deviceLogs.each(function (log) {
                log.entries.fetch({
                    success: renderGraph
                });
            });

            // My own nice color palette:
            this.palette = ["#e27c48", "#5a3037", "#f1ca4f", "#acbe80", "#77b1a7", "#858485", "#d9c7ad"];

            this.plotOptions = {
                xaxes: [{
                        mode: "time",
                        show: true,
                        timezone: settings.get("timezone")
                    },
                       ],
                grid: {
                    hoverable: true,
                    clickable: true
                },
                selection: {
                    mode: "xy"
                },
                legend: {
                    position: "ne"
                },
                colors: this.palette
            };

            this.overviewOptions = {
                legend: {
                    show: false
                },
                xaxis: {
                    mode: "time",
                    show: false,
                    ticks: 4
                },
                yaxis: {
                    ticks: 4
                },
                selection: {
                    mode: "x"
                },
                colors: this.palette,
            };

            this.prevStamp = 0;
        },

        events: {
            "click .resetZoom": "resetZoom",
            "click #download-csv": "downloadCSV"
        },

        resetZoom: function () {
            delete this.ranges;
            this.addPlot();
            return false;
        },


        render: function () {
            var self = this;
            console.log('Main render of OLED Backpack log view');
            this.$el.html(template());

            if (this.packedData == null || this.packedData.length == 0)
                this.packedData = this.packData();

            if (this.packedData.length == 0)
                return;

            this.addPlot();

            return this;
        },

        addPlot: function () {
            var self = this;
            if (this.deviceLogs == null ||  this.deviceLogs.length == 0)
                return;

            $('#log_size', this.el).html(this.deviceLogs.getOverallLength());
            $('#log_start', this.el).html(new Date(this.deviceLogs.getLogsStart()).toString());
            $('#log_end', this.el).html(new Date(this.deviceLogs.getLogsEnd()).toString());

            // Now initialize the plot area:
            console.log('Plot chart size: ' + this.$('.datachart').width());

            // Restore current zoom level if it exists:
            if (this.ranges) {
                this.voltplot = $.plot($(".datachart", this.el), this.packedData.slice(0, 3),
                    $.extend(true, {}, this.plotOptions, {
                        xaxis: {
                            min: this.ranges.xaxis.from,
                            max: this.ranges.xaxis.to
                        },
                    })
                );
                this.ampplot = $.plot($(".datachart2", this.el), this.packedData.slice(3, 6),
                    $.extend(true, {}, this.plotOptions, {
                        xaxis: {
                            min: this.ranges.xaxis.from,
                            max: this.ranges.xaxis.to
                        },
                    })
                );

            } else {
                this.voltplot = $.plot($(".datachart", this.el), this.packedData.slice(0, 3), this.plotOptions);
                this.ampplot = $.plot($(".datachart2", this.el), this.packedData.slice(3, 6), this.plotOptions);
            };

            // Create tooltips on hover:
            $(".datachart", this.el).bind("plothover", function (event, pos, item) {
                if (item) {
                    if (self.vpreviousPoint != item.dataIndex) {
                        self.vpreviousPoint = item.dataIndex;

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
                    self.vpreviousPoint = null;
                }
            });
            $(".datachart2", this.el).bind("plothover", function (event, pos, item) {
                if (item) {
                    if (self.apreviousPoint != item.dataIndex) {
                        self.apreviousPoint = item.dataIndex;

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
                    self.apreviousPoint = null;
                }
            });

            // Create the overview chart (one for both V and A for now):
            this.overview = $.plot($("#overview", this.el), [this.packedData[0], this.packedData[3]], this.overviewOptions);

            // Last, manage selection & linking to overview:
            // Connect overview and main charts
            $(".datachart", this.el).bind("plotselected", function (event, ranges) {

                // clamp the zooming to prevent eternal zoom
                if (ranges.xaxis.to - ranges.xaxis.from < 0.00001) {
                    ranges.xaxis.to = ranges.xaxis.from + 0.00001;
                }

                // Save the current range so that switching plot scale (log/linear)
                // can preserve the zoom level:
                self.ranges = ranges;

                // do the zooming
                this.voltplot = $.plot($(".datachart", this.el), self.packedData.slice(0, 3),
                    $.extend(true, {}, self.plotOptions, {
                        xaxis: {
                            min: ranges.xaxis.from,
                            max: ranges.xaxis.to
                        },
                        yaxis: {
                            min: ranges.yaxis.from,
                            max: ranges.yaxis.to
                        }
                    })
                );
                this.ampplot = $.plot($(".datachart2", this.el), self.packedData.slice(3, 6),
                    $.extend(true, {}, self.plotOptions, {
                        xaxis: {
                            min: ranges.xaxis.from,
                            max: ranges.xaxis.to
                        }
                    })
                );

                // don't fire event on the overview to prevent eternal loop
                self.overview.setSelection(ranges, true);
            });

            $(".datachart2", this.el).bind("plotselected", function (event, ranges) {

                // clamp the zooming to prevent eternal zoom
                if (ranges.xaxis.to - ranges.xaxis.from < 0.00001) {
                    ranges.xaxis.to = ranges.xaxis.from + 0.00001;
                }

                // Save the current range so that switching plot scale (log/linear)
                // can preserve the zoom level:
                self.ranges = ranges;

                // do the zooming
                this.voltplot = $.plot($(".datachart", this.el), self.packedData.slice(0, 3),
                    $.extend(true, {}, self.plotOptions, {
                        xaxis: {
                            min: ranges.xaxis.from,
                            max: ranges.xaxis.to
                        }
                    })
                );
                this.ampplot = $.plot($(".datachart2", this.el), self.packedData.slice(3, 6),
                    $.extend(true, {}, self.plotOptions, {
                        xaxis: {
                            min: ranges.xaxis.from,
                            max: ranges.xaxis.to
                        },
                        yaxis: {
                            min: ranges.yaxis.from,
                            max: ranges.yaxis.to
                        }
                    })
                );

                // don't fire event on the overview to prevent eternal loop
                self.overview.setSelection(ranges, true);
            });

            $("#overview", this.el).bind("plotselected", function (event, ranges) {
                self.voltplot.setSelection(ranges);
                self.ampplot.setSelection(ranges);
            });



        },

        onClose: function () {},

        downloadCSV: function () {
            var header = 'data:text/csv; charset=utf-8,';
            var csv = header + "Timestamp (UTC), ";
            for (var i = 0; i < this.deviceLogs.length; i++) {
                var entries = this.deviceLogs.at(i).entries;
                csv += "Vmin, Vmax, Vavg, Amin, Amax, Aavg\n";
                for (var j = 0; j < entries.length; j++) {
                    var entry = entries.at(j);
                    var data = entry.get('data');
                    // Sometimes, we get entries without a valid reading reading, detect this
                    if (data.a != undefined) {
                        // No known spreadsheet software handles ISO8601 dates
                        // properly (like 2014-06-17T18:00:04.067Z ) so we
                        // convert the timestamp to a string that is recognized by
                        // Excel and Google Docs. The whole new Date + toISOString
                        // is here to guarantee that we do get a proper formatted
                        // time stamp whenever we are running as an embedded app or a server
                        // app.
                        var ts = new Date(entry.get('timestamp')).toISOString().replace(/[TZ]/g, ' ');
                        csv += ts;
                        csv += ',' + data.v.min;
                        csv += ',' + data.v.max;
                        csv += ',' + data.v.avg;
                        csv += ',' + data.a.min;
                        csv += ',' + data.a.max;
                        csv += ',' + data.a.avg;
                        csv += '\n';
                    }
                }
            }
            var uri = encodeURI(csv);
            window.open(uri);
        },


        // At the moment we only have one log type for this device: "live"
        packData: function () {
            console.log("Start packing");
            var empty = true;
            var data = [[], [], [], [], [], []];
            var logs = this.deviceLogs;
            // At this stage we know the logs are already fetched, btw
            for (var j = 0; j < logs.length; j++) {
                var value = logs.at(j).entries;
                if (value.length > 0) empty = false;
                for (var i = 0; i < value.length; i++) {
                    var entry = value.at(i);
                    var values = entry.get('data');
                    if (values.a != undefined) { // just a failsafe...
                        var stamp = new Date(entry.get('timestamp')).getTime();
                        data[0].push([stamp, values.v.min]);
                        data[1].push([stamp, values.v.max]);
                        data[2].push([stamp, values.v.avg]);
                        data[3].push([stamp, values.a.min]);
                        data[4].push([stamp, values.a.max]);
                        data[5].push([stamp, values.a.avg]);
                    }
                }
            }
            console.log("Done packing");
            if (empty) return [];
            return [
                {
                    data: data[2],
                    label: "V",
                    color: this.color
                },
                {
                    data: data[0],
                    label: "Vmin",
                    id: "vmin"
                },
                {
                    data: data[1],
                    label: "Vmax",
                    id: "vmax",
                    lines: {
                        show: true,
                        fill: true
                    },
                    fillBetween: "vmin"
                },
                {
                    data: data[5],
                    label: "mA"
                },
                {
                    data: data[3],
                    label: "Amin",
                    id: "amin"
                },
                {
                    data: data[4],
                    label: "Amax",
                    id: "amax",
                    lines: {
                        show: true,
                        fill: true
                    },
                    fillBetween: "amin"
                }
            ];
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