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
 * Log view for the Onyx.
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
        utils = require('app/utils'),
        fileutils = require('app/lib/fileutils'),
        template = require('js/tpl/instruments/bgeigie/LogView.js');

    // Load the flot library & flot time plugin:
    require('flot');
    require('flot_time');
    require('flot_resize');
    require('flot_selection');

    return Backbone.View.extend({

        initialize: function () {
            var self = this;

            this.deviceLogs = this.collection;
            this.packedData = null;
            this.previousPoint = null;

            // Need this to make sure "render" will always be bound to our context.
            // -> required for the _.after below.
            _.bindAll(this, "render");

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
        },

        handleProgress: function (e) {
            $('#loadtext').html("Loaded: " + e.loaded + " bytes");
        },

        events: {
            "click .resetZoom": "resetZoom",
            "click #cpmscale": "cpmScaleToggle",
            "click #send-to-api": "generateLog",
            "click #send-log": "sendLog"
        },

        resetZoom: function () {
            delete this.ranges;
            this.plot.plotOptions = this.plotSettings.plot_options;
            this.plot.addPlot();
            this.plot.redraw();
            return false;
        },

        render: function () {
            var self = this;
            console.log('Main render of Log details view');

            $(this.el).html(template());

            this.addPlot();
            if (this.packedData == null || this.packedData.length == 0)
                this.packedData = this.packData();

            if (this.packedData.length == 0)
                return;
            return this;
        },

        onClose: function () {
            console.log("Log view closing...");

            // Remove the window resize bindings on our plots:
            this.plot.onClose();
            if (this.overview)
                this.overview.onClose();
        },

        /**
         * Generates a Safecast bGeigie compliant 'drive' file, then
         * call the uploadLog method for the actual upload
         */
        generateLog: function () {
            var self = this;
            $('#send-to-api', this.el).html('Generating...').addClass('btn-success').attr('disabled', true);;
            fileutils.newLogFile("safecast-upload.log", function (file) {
                file.createWriter(function (fileWriter) {
                    // ToDo: create the header for the file
                    for (var i = 0; i < self.deviceLogs.length; i++) {
                        var currentLog = self.deviceLogs.at(i);
                        var entries = currentLog.entries;
                        // Now iterate over all the log entries and generate
                        // the aggregate log files.
                        var index = 0;
                        var write = function (evt) {
                            if (index == entries.length) {
                                self.addMetadata(file);
                                return;
                            }
                            var entry = entries.at(index);
                            index++;
                            var data = entry.get('data');
                            // Sometimes, we get entries without a valid reading, detect this
                            if (data.nmea) {
                                fileWriter.write(data.nmea + '\n');
                            }
                        };
                        fileWriter.onwrite = write;
                        write(0);
                    }
                }, function (e) {
                    console.log(e);
                });
            });
        },

        /**
         * Upload the log to Safecast
         * @param {Object} file The file descriptor for the log.
         */
        addMetadata: function (file) {
            $('#send-to-api', this.el).html('Done').removeAttr('disabled');
            this.logfile = file;
            // ToDo: ask the user a couple of extra questions on the drive
            // (fill in defaults to make it easy), and do the upload.
            $('#UploadModal', this.el).modal('show');
        },

        sendLog: function () {
        
        
        },

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

            // We don't create an overview on small screens, does not make sense
            if (!(utils.checkBreakpoint('sm') || utils.checkBreakpoint('xs'))) {
                this.overview = new simpleplot({
                    model: this.model,
                    settings: this.plotOverviewSettings
                });
            }

            if (this.overview != null) {
                $('#overview', this.el).empty().append(this.overview.el);
                this.overview.render();
            } else {
                $('#overview-container', this.el).empty();
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
                        if (this.overview)
                            this.overview.fastAppendPoint({
                                name: 'CPM',
                                value: cpm,
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
            if (this.overview)
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