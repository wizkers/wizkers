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
        template = require('js/tpl/instruments/blueonyx/LogView.js');

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


            // TODO: save color palette in settings ?
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
            "click #csv-export": "downloadCSV",
            'click #send-to-api': 'makeNMEA',
            "click .send-log": "sendLog",
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
            console.log('[BlueOnyx] Log view closing...');

            // Remove the window resize bindings on our plots:
            this.plot.onClose();
            if (this.overview)
                this.overview.onClose();
            // Restore the settings since we don't want them to be saved when changed from
            // the home screen
            settings.fetch();
        },

        downloadCSV: function () {
            var header = 'data:text/csv; charset=utf-8,\n';
            var csv = header + "Timestamp (UTC), ";
            for (var i = 0; i < this.deviceLogs.length; i++) {
                var currentLog = this.deviceLogs.at(i);
                var entries = currentLog.entries;
                var type = currentLog.get('logtype');
                if (type == 'live') {
                    csv += "CPM, CPM30, USV, COUNT, Valid, latitude, longitude, altitude, accuracy, loc_status\n";
                }
                for (var j = 0; j < entries.length; j++) {
                    var entry = entries.at(j);
                    var data = entry.get('data');
                    // Sometimes, we get entries without a valid CPM reading, detect this
                    if (data.cpm) {
                        // No known spreadsheet software handles ISO8601 dates
                        // properly (like 2014-06-17T18:00:04.067Z ) so we
                        // convert the timestamp to a string that is recognized by
                        // Excel or Google Docs. The whole new Date + toISOString
                        // is here to guarantee that we do get a proper formatted
                        // time stamp whenever we are running as an embedded app or a server
                        // app.
                        var ts = new Date(entry.get('timestamp')).toISOString().replace(/[TZ]/g, ' ');
                        csv += ts;
                        // Our live data is packed a bit differently than onyxlog data
                        // Note: I tried a generic "for key in data" but the order
                        // the keys are returned can change randomly, leading to wrong outout, which is
                        // why I am using explicit key names:
                        if (type == 'live') {
                            csv += ',' + data.cpm.value +
                                ',' + data.cpm.cpm30 +
                                ',' + data.cpm.usv +
                                ',' + data.cpm.count +
                                ',' + data.cpm.valid;
                        }
                        if (data.loc) {
                            csv += ',' + data.loc.coords.latitude +
                                ',' + data.loc.coords.longitude +
                                ',' + data.loc.coords.altitude +
                                ',' + data.loc.coords.accuracy +
                                ',' + data.loc_status;
                        }
                        csv += '\n';
                    }
                }
            }
            var uri = encodeURI(csv);
            if (vizapp.type != 'cordova') {
                window.open(uri);
            } else {
                var self = this;
                // In Cordova mode, we create a file
                var fname = 'blueonyxlog-' + new Date().getTime() + '.csv';
                fileutils.newLogFile(fname, function (file) {
                    file.createWriter(function (fileWriter) {
                        fileWriter.write(csv);
                        $('#errorreason', self.el).html('Log saved');
                        $('#errordetail', self.el).html('Your logfile was saved on your device in "Wizkers/logs/' + fname + '"');
                        $('#ErrorModal').modal();
                    });
                });
            }
        },
        
        /**
         * Get a latitude, or longitude and convert it to a NMEA compliant string
         *   islat: true if "dec" is a latitude. Otherwise it's a longitude
         */
        toNMEALatCoord: function(dec) {
            var ltr = (dec < 0) ? 'S' : 'N'; 
            if (dec<0) dec = -dec;
            var dd = Math.floor(dec);
            var mm = (dec-dd) * 60;
            var dds = ('0' + dd).slice(-2);
            var mms = (((mm<10) ? '0' : '') + mm.toFixed(4)).slice(-7); 
            return dds + mms + ',' + ltr;
        },
        
        toNMEALonCoord: function(dec) {
            var ltr = (dec < 0) ? 'W' : 'E'; 
            if (dec<0) dec = -dec;
            var dd = Math.floor(dec);
            var mm = (dec-dd) * 60;
            var dds = ('00' + dd).slice(-3);
            var mms = (((mm<10) ? '0' : '') + mm.toFixed(4)).slice(-7); 
            return dds + mms + ',' + ltr;
        },
        
        nmeaChecksum: function (str) {
            var chk = 0;
            for (var i =0; i < str.length; i++) {
                chk ^= str.charCodeAt(i);                
            }
            return ((chk < 16) ? '0' : '') + chk.toString(16);
        },
        
        /**
         * Transform the internal log into a NMEA (in-memory) log that is compliant with what
         * Safecast expects.
         * A typical NMEA sentence generated by the bGeigie is:
         * $BNRDD,1105,2015-12-27T17:59:41Z,30,1,122,A,4916.7710,N,12306.6464,W,90.70,A,9,98*65
         * Header : BNXRDD
         * Device ID : Device serial number. 300
         * Date : Date formatted according to iso-8601 standard. Usually uses GMT. 2012-12-16T17:58:31Z
         * Radiation 1 minute : number of pulses given by the Geiger tube in the last minute. 30
         * Radiation 5 seconds : number of pulses given by the Geiger tube in the last 5 seconds. 1
         * Radiation total count : total number of pulses recorded since startup. 116
         * Radiation count validity flag : 'A' indicates the counter has been running for more than one minute and the 1 minute count is not zero. Otherwise, the flag is 'V' (void). A
         * Latitude : As given by GPS. The format is ddmm.mmmm where dd is in degrees and mm.mmmm is decimal minute. 4618.9612
         * Hemisphere : 'N' (north), or 'S' (south). N
         * Longitude : As given by GPS. The format is dddmm.mmmm where ddd is in degrees and mm.mmmm is decimal minute. 00658.4831
         * East/West : 'W' (west) or 'E' (east) from Greenwich. E
         * Altitude : Above sea level as given by GPS in meters. 443.7
         * GPS validity : 'A' ok, 'V' invalid. A
         * Number of satellites
         * Accuracy (?)
         * Checksum. *1D
         */
        makeNMEA: function() {
            var count = 0;
            var sn = instrumentManager.getInstrument().get("uuid");
            var inMemLog = '# Blue Onyx drive\n' +
                           '# Serial Number: ' + sn + '\n####\n';
            for (var i = 0; i < this.deviceLogs.length; i++) {
                var currentLog = this.deviceLogs.at(i);
                var entries = currentLog.entries;
                for (var i = 0; i <  entries.length; i++) {
                    var data = entries.at(i).get('data');
                    var ts = entries.at(i).get('timestamp');
                    // Sometimes, we get entries without a valid reading, detect this
                    if (data.cpm) {
                        count += data.cp5s; 
                        var line = '$BNRDD,' + sn + ',' + new Date(ts).toISOString() + ',' +
                                    data.cpm.value.toFixed(0) + ',' +
                                    data.cp5s + ',' +  // 5 second CPM
                                    count + ',' +  // Total count
                                    (data.cpm.valid ? 'A' : 'V') + ',';
                        if (data.loc) {
                               line += this.toNMEALatCoord(data.loc.coords.latitude) + ',' +
                                    this.toNMEALonCoord(data.loc.coords.longitude) + ',' +
                                    // Depending on loc source Altitude can be 'null'
                                    ((data.loc.coords.altitude) ? data.loc.coords.altitude.toFixed(2) : '0') + ',' +
                                    ((data.loc_status == 'OK') ? 'A' : 'V') + ',' + // GPS Validity
                                    '0,' +  // Number of satellites (we don't have it)
                                    data.loc.coords.accuracy;   // Accurary
                        } else {
                            line += '00.0000,N,000.0000,W,V,0,0';
                        }
                        inMemLog += line + '*' + this.nmeaChecksum(line) + '\n';
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
                api_key: apikey,
                'bgeigie_import[name]': 'bgeigie.log',
                'bgeigie_import[credits]': $('#credits').val(),
                'bgeigie_import[cities]': $('#cities').val(),
                'bgeigie_import[description]': $('#description').val()
            };

            // Two possibilities: we are either sending an in-mem log (string), or
            // a file
            var post_options = {
                host: 'api.safecast.org',
                port: 80,
                method: 'POST',
                path: '/bgeigie_imports.json',
                headers: {
                    'X-Datalogger': 'wizkers.io App',
                }
            };

            params['bgeigie_import[source]'] = this.logfile;
            var post_data = httprequest.multipart(params, 'bgeigie_import[source]');
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
                if (!err) {
                    stats.instrumentEvent('safecast_upload', 'success');
                    $('#UploadModal', self.el).modal('hide');
                    $('#myErrorLabel', self.el).html('Success');
                    $('#errorreason', self.el).html('Your log was uploaded to Safecast');
                    $('#errordetail', self.el).html('Keep up the good work :)');
                    $('#ErrorModal').modal('show');
                    }
            });
            post_request.send(post_data);
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

            if (this.overview) {
                $('#overview', this.el).empty().append(this.overview.el);
                this.overview.render();
            } else {
                $('#overview-container', this.el).empty();
            }

            // Only render the plot after the overview is (maybe) removed, so that
            // it stretches properly
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

                        // If we have min/max values in the recording and we have a proper CPM reading
                        // (not CPM30) then record those as well:
                        if (entry.get('data').type == 'CPM') {
                            this.plot.fastAppendPoint({
                                value: entry.get('data').min,
                                name: 'Minimum',
                                timestamp: stamp,
                                options: {
                                    id: "min"
                                }
                            });
                            this.plot.fastAppendPoint({
                                value: entry.get('data').max,
                                name: "Maximum",
                                timestamp: stamp,
                                options: {
                                    lines: {
                                        show: true,
                                        fill: true
                                    },
                                    fillBetween: "min"
                                },
                            });
                        }


                    }
                    if (entry.get('data').cpm2 != undefined) {
                        var cpm2 = parseFloat(entry.get('data').cpm2.value);
                        this.plot.fastAppendPoint({
                            'name': "CPM2",
                            'value': cpm2,
                            timestamp: stamp
                        });
                        if (this.overview)
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