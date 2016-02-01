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
        httprequest = require('app/lib/httprequest'),
        template = require('js/tpl/instruments/bgeigie/LogView.js');

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
            "click .send-log": "sendLog",
            "click #csv-export": "saveToCSV"
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

            this.$el.html(template());

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

        saveToCSV: function () {
            var self = this;
            $('#csv-export', this.el).html('Generating...').addClass('btn-success').attr('disabled', true);
            var fname = "safecast-drive" + new Date().getTime() + ".csv";
            fileutils.newLogFile(fname, function (file) {
                file.createWriter(function (fileWriter) {
                    // ToDo: create the header for the file, though the API
                    // does not seem to mind too much it's not there...
                    for (var i = 0; i < self.deviceLogs.length; i++) {
                        var currentLog = self.deviceLogs.at(i);
                        var entries = currentLog.entries;
                        // Now iterate over all the log entries and generate
                        // the aggregate log files.
                        var index = 0;
                        var write = function (str) {
                            if (typeof str == 'string') {
                                fileWriter.write(str + '\n');
                                return;
                            }
                            if (index == entries.length) {
                                $('#UploadModal', self.el).modal('hide');
                                $('#myErrorLabel', self.el).html('Success');
                                $('#errorreason', self.el).html('Your log was saved as CSV');
                                $('#errordetail', self.el).html('you can find it in /wizkers/logs/' + fname + ' on your device.');
                                $('#ErrorModal').modal('show');
                                return;
                            }
                            var entry = entries.at(index++);
                            var data = entry.get('data');
                            var line = new Date(entry.get('timestamp')).toISOString() + ',';
                            // Sometimes, we get entries without a valid reading, detect this
                            if (data && data.cpm) {
                                line += data.cpm.value + ',' +
                                    data.cpm.count + ',' +
                                    data.cpm.usv + ',';
                                if (data.loc) {
                                    line += data.loc.coords.latitude + ',' +
                                        data.loc.coords.longitude + ',' +
                                        data.loc.sats + ',' +
                                        data.loc_status;
                                }
                            }
                            // Careful: only ONE '.write' call in the write callback...
                            fileWriter.write(line + '\n');
                        };
                        fileWriter.onwrite = write;
                        write('# Android Safecast:Drive CSV Export\nTimestamp,CPM,count,usv,latitude,longitude,sats,lock');
                    }
                }, function (e) {
                    console.log(e);
                });
            });
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
                    // ToDo: create the header for the file, though the API
                    // does not seem to mind too much it's not there...
                    for (var i = 0; i < self.deviceLogs.length; i++) {
                        var currentLog = self.deviceLogs.at(i);
                        var entries = currentLog.entries;
                        // Now iterate over all the log entries and generate
                        // the aggregate log files.
                        var index = 0;
                        var write = function (str) {
                            if (typeof str == 'string') {
                                fileWriter.write(str + '\n');
                                return;
                            }

                            if (index == entries.length) {
                                self.addMetadata(file);
                                return;
                            }
                            var entry = entries.at(index++);
                            var data = entry.get('data');
                            // Sometimes, we get entries without a valid reading, detect this
                            if (data && data.nmea) {
                                fileWriter.write(data.nmea + '\n');
                            } else {
                                fileWriter.write('# break\n');
                            }
                        };
                        fileWriter.onwrite = write;
                        write('# Android Safecast:Drive log');
                    }
                }, function (e) {
                    console.log(e);
                });
            });
        },

        /**
         * Same as generateLog but keeps the log in-memory only, to avoid
         * requiring access to the filesystem, which can be creepy.
         */
        generateInMemoryLog: function () {
            var inMemLog = '';
            for (var i = 0; i < self.deviceLogs.length; i++) {
                var currentLog = self.deviceLogs.at(i);
                var entries = currentLog.entries;
                for (entry in entries) {
                    var data = entries[entry].get('data');
                    // Sometimes, we get entries without a valid reading, detect this
                    if (data.nmea) {
                        inMemLog += (data.nmea + '\n');
                    }
                }
                this.addMetadata(inMemLog);
            }
        },

        /**
         * Upload the log to Safecast
         * @param {Object} file The file descriptor for the log.
         */
        addMetadata: function (file) {
            $('#send-to-api', this.el).html('Done').removeAttr('disabled');
            this.logfile = file;
            // Ask the user a couple of extra questions on the drive
            // (fill in defaults to make it easy), and do the upload.
            var descr = this.deviceLogs.at(0).get('description');
            if (descr) {
                $('#description').val(descr);
            }
            $('#UploadModal', this.el).modal('show');
        },

        sendLog: function () {
            var self = this;

            // Before going further, we want to make sure the "credits" and "cities" fields
            // are not empty
            var ok = true;
            if ($('#credits').val() == '') {
                $('#credits').parent().parent().addClass('has-error');
                ok = false;
            } else {
                $('#credits').parent().parent().removeClass('has-error');
            }
            if ($('#cities').val() == '') {
                $('#cities').parent().parent().addClass('has-error');
                ok = false;
            } else {
                $('#cities').parent().parent().removeClass('has-error');
            }

            if (!ok)
                return;

            var apikey;
            if (instrumentManager.getInstrument().get('metadata'))
                apikey = instrumentManager.getInstrument().get('metadata').apikey;

            if (typeof apikey == 'undefined') {
                $('#UploadModal', self.el).modal('hide');
                $('#errorreason', this.el).html("API Key missing");
                $('#errordetail', this.el).html("Please add your api.safecast.org API key in the bGeigie configuration settings.");
                $('#ErrorModal').modal();
                return;
            }

            // Disable the send button to make sure the user does not touch multiple times
            $('.send-log', this.el).html('Sending...').addClass('btn-success').attr('disabled', true);;

            var params = {
                api_key: instrumentManager.getInstrument().get('metadata').apikey,
                'bgeigie_import[name]': 'bgeigie.log',
                'bgeigie_import[credits]': $('#credits').val(),
                'bgeigie_import[cities]': $('#cities').val(),
                'bgeigie_import[description]': $('#description').val()
            };

            // Two possibilities: we are either sending an in-mem log (string), or
            // a file
            if (typeof this.logfile == 'string') {
                var post_options = {
                    host: 'api.safecast.org',
                    port: 80,
                    method: 'POST',
                    path: '/bgeigie_imports.json',
                    headers: {
                        'X-Datalogger': 'wizkers.io Safecast Drive app',
                        'Content-Type': 'application/x-www-form-urlencoded',
                    }
                };

                params['bgeigie_import[source]'] = this.logfile;
                var post_data = httprequest.stringify(params);
                var post_request = httprequest.request(post_options, function (res) {
                    var err = true;
                    console.log("[Safecast log file post] API Request result");
                    // this is the xmlhttprequest
                    switch (this.status) {
                    case 0: // Cannot connect
                        console.log('Cannot connect to Safecast');
                        break;
                    case 201: // success
                        console.log(this.statusText);
                        err = false;
                        break;
                    default:
                        console.log(this.statusText);
                        break;
                    }
                });
                post_request.send(post_data);

            } else {
                // We are going to use the fileutils library to do the file transfers,
                // so that we can abstract between platforms (android, server, etc)

                // The downside here is that this means the app will require access to the
                // filesystem, which can freak people out. The alternative is to do all in-memory.

                var options = fileutils.FileUploadOptions();
                options.fileKey = 'bgeigie_import[source]';
                options.fileName = this.logfile.nativeURL.substr(this.logfile.nativeURL.lastIndexOf('/') + 1);
                options.mimeType = 'text/plain';

                options.params = params;
                fileutils.sendFile(this.logfile.nativeURL,
                    'http://api.safecast.org/bgeigie_imports.json',
                    function (success) {
                        console.log('success', success);
                        stats.instrumentEvent('safecast_upload', 'success');
                        $('#UploadModal', self.el).modal('hide');
                        $('#myErrorLabel', self.el).html('Success');
                        $('#errorreason', self.el).html('Your log was uploaded to Safecast');
                        $('#errordetail', self.el).html('Keep up the good work :)');
                        $('#ErrorModal').modal('show');
                    },
                    function (failure) {
                        console.log('failure', failure);
                        $('#UploadModal', self.el).modal('hide');
                        var errorDescription = 'Could not upload the file';
                        if (failure.body && failure.body.indexOf('md5sum') > -1) {
                            errorDescription = 'This log is already uploaded, no need to resubmit it';
                        }
                        $('#errorreason', self.el).html('Upload Error');
                        $('#errordetail', self.el).html(errorDescription);
                        $('#ErrorModal').modal('show');
                        stats.instrumentEvent('safecast_upload', errorDescription);
                    }, options);
            }
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

            if (this.plot != null) {
                $('.geigerchart', this.el).empty().append(this.plot.el);
                this.plot.render();
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
                        var cpm = entry.get('data').cpm.value;
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