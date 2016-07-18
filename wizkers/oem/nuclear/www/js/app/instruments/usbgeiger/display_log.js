/**
 * This file is part of Wizkers.io
 *
 * The MIT License (MIT)
 *  Copyright (c) 2016 Edouard Lafargue, ed@wizkers.io
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the Software
 * is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR
 * IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

/*
 * Log view for the USB Geiger devices.
 *
 * Our model is a collection of Logs
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */

define(function (require) {
    "use strict";

    var $ = require('jquery'),
        _ = require('underscore'),
        Backbone = require('backbone'),
        simpleplot = require('app/lib/flotplot'),
        template = require('js/tpl/instruments/USBGeigerLogView.js');

    return Backbone.View.extend({

        initialize: function () {
            var self = this;

            this.deviceLogs = this.collection;
            this.packedData = null;
            this.previousPoint = null;

            // Need this to make sure "render" will always be bound to our context.
            // -> required for the _.after below.
            _.bindAll(this, "render");

            // Now fetch all the contents, then render
            var renderGraph = _.after(this.deviceLogs.length, this.render);
            this.deviceLogs.each(function (log) {
                log.entries.fetch({
                    success: renderGraph,
                    xhr: function () {
                        var xhr = $.ajaxSettings.xhr();
                        xhr.onprogress = self.handleProgress;
                        return xhr;
                    }
                });
            });

            // We will pass this when we create plots, this is the global
            // config for the look and feel of the plot
            this.plotSettings = {
                selectable: true,
                vertical_stretch: true,
                points: 0,
                plot_options: {
                    xaxis: {
                        mode: "time",
                        show: true,
                        timeformat: "%Y.%m.%d<br>%H:%M",
                        timezone: settings.get("timezone"),
                    },
                    yaxis: {},
                    grid: {
                        hoverable: true,
                        clickable: true
                    },
                    legend: {
                        position: "ne"
                    },
                    colors: this.palette,
                }
            };

            this.plotOverviewSettings = {
                selectable: true,
                vertical_stretch: false,
                points: 0,
                plot_options: {
                    xaxis: {
                        mode: "time",
                        show: true,
                        timeformat: "%m.%d",
                        timezone: settings.get("timezone"),
                    },
                    yaxis: {},
                    colors: this.palette,
                }
            };

            // My own nice color palette:
            this.palette = ["#e27c48", "#5a3037", "#f1ca4f", "#acbe80", "#77b1a7", "#858485", "#d9c7ad"];

        },

        handleProgress: function (e) {
            $('#loadtext').html("Loaded: " + e.loaded + " bytes");
        },

        events: {
            "click .resetZoom": "resetZoom",
            "click #cpmscale": "cpmScaleToggle",
            "click .ctrl-edit": "editLog",
            "click #download-csv": "downloadCSV"
        },

        resetZoom: function () {
            delete this.ranges;
            this.plot.plotOptions = this.plotSettings.plot_options;
            this.plot.addPlot();
            this.plot.redraw();
            return false;
        },

        cpmScaleToggle: function (event) {
            return;
            var change = {};
            if (event.target.checked) {
                change["cpmscale"] = "log";
            } else {
                change["cpmscale"] = "linear";
            }
            settings.set(change);
            this.render();
            this.addPlot();

        },

        editLog: function () {
            console.log('Edit Log');
            var logIds = [];
            _.each(this.deviceLogs.models, function (log) {
                logIds.push(log.id);
            });
            router.navigate('editlogs/' + instrumentManager.getInstrument().id + '/' + logIds.join(','), true);
        },

        render: function () {
            var self = this;
            console.log('Main render of Log details view');

            this.$el.html(template());

            this.addPlot();
            if (this.packedData == null || this.packedData.length == 0)
                this.packedData = this.packData();

            if (this.packedData.length == 0)
                return;
            return this;
        },

        onClose: function () {
            console.log("Log management view closing...");

            // Remove the window resize bindings on our plots:
            this.plot.onClose();
            this.overview.onClose();
            // Restore the settings since we don't want them to be saved when changed from
            // the home screen
            settings.fetch();
        },

        downloadCSV: function () {
            var header = 'data:text/csv; charset=utf-8,';
            var csv = header + "Timestamp (UTC), ";
            for (var i = 0; i < this.deviceLogs.length; i++) {
                var entries = this.deviceLogs.at(i).entries;
                csv += "Channel1, Channel1_valid, Channel2, Channel2_valid\n";
                for (var j = 0; j < entries.length; j++) {
                    var entry = entries.at(j);
                    var data = entry.get('data');
                    // Sometimes, we get entries without a valid CPM reading, detect this
                    if (data.cpm) {
                        // No known spreadsheet software handles ISO8601 dates
                        // properly (like 2014-06-17T18:00:04.067Z ) so we
                        // convert the timestamp to a string that is recognized by
                        // Excel and Google Docs. The whole new Date + toISOString
                        // is here to guarantee that we do get a proper formatted
                        // time stamp whenever we are running as an embedded app or a server
                        // app.
                        var ts = new Date(entry.get('timestamp')).toISOString().replace(/[TZ]/g, ' ');
                        csv += ts;
                        csv += ',' + data.cpm.value;
                        csv += ',' + data.cpm.valid;
                        if (data.cpm2) {
                            csv += ',' + data.cpm2.value;
                            csv += ',' + data.cpm2.valid;
                        }
                        csv += '\n';
                    }
                }
            }
            var uri = encodeURI(csv);
            window.open(uri);
        },


        // We can only add the plot once the view has finished rendering and its el is
        // attached to the DOM, so this function has to be called from the home view.
        addPlot: function () {
            var self = this;

            if (this.deviceLogs == null ||  this.deviceLogs.length == 0)
                return;

            $('#log_size', this.el).html(this.deviceLogs.getOverallLength());
            $('#log_start', this.el).html(new Date(this.deviceLogs.getLogsStart()).toString());
            $('#log_end', this.el).html(new Date(this.deviceLogs.getLogsEnd()).toString());

            this.plot = new simpleplot({
                model: this.model,
                settings: this.plotSettings
            });
            if (this.plot != null) {
                $('.geigerchart', this.el).empty().append(this.plot.el);
                this.plot.render();
            }

            this.overview = new simpleplot({
                model: this.model,
                settings: this.plotOverviewSettings
            });
            if (this.overview != null) {
                $('#overview', this.el).empty().append(this.overview.el);
                this.overview.render();
            }

            // Restore current zoom level if it exists:
            if (this.ranges) {
                this.plot.plotOptions = $.extend(true, {}, this.plotSettings.plot_options, {
                    xaxis: {
                        min: this.ranges.xaxis.from,
                        max: this.ranges.xaxis.to
                    },
                    yaxis: {
                        min: this.ranges.yaxis.from,
                        max: this.ranges.yaxis.to
                    }
                });
            }

        },


        // Depending on log type, we need to pack our data differently...
        packData: function () {
            var self = this;
            // Create a table of Y values with the x values from our collection
            var data = [];
            var logs = this.deviceLogs;
            // At this stage we know the logs are already fetched, btw
            for (var j = 0; j < logs.length; j++) {
                var ret = [];
                var value = logs.at(j).entries;
                var type = logs.at(j).get('logtype');
                for (var i = 0; i < value.length; i++) {
                    var entry = value.at(i);
                    // Be sure we only plot CPM entries (we might have anything in the
                    // log...
                    var stamp = new Date(entry.get('timestamp')).getTime();
                    if (entry.get('data').cpm != undefined) {
                        var cpm = parseFloat((type == 'onyxlog') ? entry.get('data').cpm : entry.get('data').cpm.value);
                        this.plot.fastAppendPoint({
                            name: 'CPM',
                            value: cpm,
                            timestamp: stamp
                        });
                        this.overview.fastAppendPoint({
                            name: 'CPM',
                            value: cpm,
                            timestamp: stamp
                        });
                    }
                    if (entry.get('data').cpm2 != undefined) {
                        var cpm2 = parseFloat(entry.get('data').cpm2.value);
                        this.plot.fastAppendPoint({
                            'name': "CPM2",
                            'value': cpm2,
                            timestamp: stamp
                        });
                        this.overview.fastAppendPoint({
                            'name': "CPM2",
                            'value': cpm2,
                            timestamp: stamp
                        });
                    }
                }
                if (ret.length)
                    data.push({
                        data: ret,
                        label: "CPM"
                    });
            }
            this.plot.redraw();
            this.overview.redraw();
            return data;
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