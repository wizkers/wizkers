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
 * A generic Flot plot, do be used by any instrument that requires it
 *
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */

define(function (require) {
    "use strict";

    var $ = require('jquery'),
        _ = require('underscore'),
        Backbone = require('backbone');

    // Load the flot library & flot time plugin:
    require('flot');
    require('flot_time');
    require('flot_selection');
    require('flot_resize');

    return Backbone.View.extend({

        initialize: function (options) {

            // Beware: we define "this.rsc" here because if we define it as a "var" on top, the requireJS caching
            // mechanism will turn it into one single reference for every flotplot instance, which is now what we want!
            // Make sure the chart takes all the window height:
            this.rsc = null;

            // Here are all the options we can define, to pass as "settings" when creating the view:
            this.flotplot_settings = {
                points: 150,
                log: false,
                showtips: true,
                selectable: false,
                vertical_stretch: false,
                plot_options: {
                    xaxis: {
                        mode: "time",
                        show: true,
                        timezone: settings.get("timezone")
                    },
                    grid: {
                        hoverable: true,
                        clickable: true
                    },
                    legend: {
                        position: "ne",
                        container: $('#legend')
                    },
                    colors: ["#e27c48", "#5a3037", "#f1ca4f", "#acbe80", "#77b1a7", "#858485", "#d9c7ad"],
                },

                get: function (key) {
                    return this[key];
                },
            };



            // Replace defaults by our own config for all keys
            // passed - if any
            if (options && options.settings) {
                for (var prop in options.settings) {
                    this.flotplot_settings[prop] = options.settings[prop];
                }
            }

            // livedata is an array of all readings.
            // We can have multiple values plotted on the chart, so this is
            // an array of arrays.
            this.livedata = [[]];
            this.sensors = [];
            this.plotData = [];
            this.previousPoint = null;

            this.plotOptions = this.flotplot_settings.plot_options;

            if (this.flotplot_settings.selectable) {
                // Extend the plot options to make it possible to do XY selections
                this.plotOptions.selection = {
                    mode: "xy"
                };

            }
        },

        // We have to call onClose when removing this view, because otherwise
        // the window resize callback lives on as a zombie and tries to resize
        // any chart anywhere...
        onClose: function () {
            if (this.flotplot_settings.vertical_stretch) {
                $(window).off('resize', this.rsc);
            }
        },

        render: function () {
            console.log("Rendering a simple chart widget");
            $(this.el).html('<div class="chart" style="position: relative; min-height: 100px;"></div>');
            this.addPlot();
            return this;
        },

        addPlot: function () {
            var self = this;
            // Now initialize the plot area:
            // this.plotOptions.legend = { container: $('#legend',this.el) };
            this.plot = $.plot($(".chart", this.el), [{
                data: [],
                label: "??",
                color: this.color
            }], this.plotOptions);

            // Adjust whether we want a log display, or linear (setup in global settings)
            if (settings.get('cpmscale') == "log") {
                this.plotOptions.yaxis = {
                    min: 1,
                    //ticks: [1,10,30,50,100,500,1000,1500],
                    transform: function (v) {
                        return Math.log(v + 10);
                    },
                    inverseTransform: function (v) {
                        return Math.exp(v) - 10;
                    }
                };
            } else if ('yaxis' in this.plotOptions) {
                delete this.plotOptions.yaxis.min;
                delete this.plotOptions.yaxis.transform;
                delete this.plotOptions.yaxis.inverseTransform;
            }

            // Add Tooltips
            if (!this.flotplot_settings.showtips)
                return;

            $(".chart", this.el).bind("plothover", function (event, pos, item) {
                if (item) {
                    $("#tooltip").remove();
                    var x = item.datapoint[0],
                        y = item.datapoint[1];

                    self.showTooltip(item.pageX, item.pageY,
                        "<small>" + ((settings.get('timezone') === 'UTC') ?
                            new Date(x).toUTCString() :
                            new Date(x).toString()) + "</small><br>" + item.series.label + ": <strong>" + y + "</strong>");
                } else {
                    $("#tooltip").remove();
                }
            });

            // Connect overview and main charts
            if (this.flotplot_settings.selectable) {
                $(".chart", this.el).on("plotselected", function (event, ranges) {

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
                    self.plotOptions = $.extend(true, {}, self.plotOptions, {
                        xaxis: {
                            min: ranges.xaxis.from,
                            max: ranges.xaxis.to
                        },
                        yaxis: {
                            min: ranges.yaxis.from,
                            max: ranges.yaxis.to
                        }
                    });

                    self.render();
                    self.redraw();

                    // Pass event onwards
                    self.trigger("plotselected", event, ranges);
                });
            }

            $('.chart', this.el).css('height', $(this.el).parent().css('height'));
            if (this.flotplot_settings.vertical_stretch) {
                var self = this;
                var rsc = function () {
                    console.log("Window resized (Flot plot)");
                    var chartheight = window.innerHeight - $(self.el).offset().top - 20;
                    if (settings.get("showstream"))
                        chartheight -= ($('#showstream').height() + 20);

                    $('.chart', self.el).css('height',chartheight + 'px');
                }
                this.rsc = rsc;
                $(window).on('resize', this.rsc);
                rsc();
            }
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
        
        // Clears all graph data
        clearData: function() {
            this.livedata = [[]];
            this.sensors = [];
        },


        trimLiveData: function (idx) {
            if (this.livedata[idx].length >= this.flotplot_settings.points) {
                this.livedata[idx] = this.livedata[idx].slice(1);
            }
        },

        // Append a data point. Data should be in the form of
        // { name: "measurement_name", value: value } or
        // { name: "measurement_name", value: value, timestamp: timestamp }
        fastAppendPoint: function (data) {
            var sensor = data.name;
            var idx = this.sensors.indexOf(sensor);
            if (idx == -1) {
                this.sensors.push(sensor);
                this.livedata.push([]);
                idx = this.sensors.length - 1;
            }
            if (this.flotplot_settings.points) this.trimLiveData(idx);
            var stamp = (data.timestamp) ? new Date(data.timestamp).getTime() : new Date().getTime();
            this.livedata[idx].push([stamp, data.value]);
        },

        redraw: function () {
            var plotData = [];
            // Now pack our live data:
            for (var i = 0; i < this.sensors.length; i++) {
                plotData.push({
                    data: this.livedata[i],
                    label: this.sensors[i]
                });
            }
            // Now update our plot
            this.plot.setData(plotData);
            this.plot.setupGrid();
            this.plot.draw();
        },

        // This method forces a redraw and is slow: use fastAppendPoint for
        // loading a large number of points before redrawing
        appendPoint: function (data) {
            this.fastAppendPoint(data);
            this.redraw();
        }

    });

});