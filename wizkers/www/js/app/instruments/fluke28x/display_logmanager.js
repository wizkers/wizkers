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

/**
 * A screen to manage on-device data/logs and download it to
 * our database.
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */


define(function (require) {
    "use strict";

    var $ = require('jquery'),
        _ = require('underscore'),
        Backbone = require('backbone'),
        utils = require('app/utils'),
        Devicelog = require('app/models/devicelog'),
        template = require('js/tpl/instruments/Fluke289LogManagementView.js'),
        tls_template = require('js/tpl/instruments/Fluke289/Fluke289TrendlogSummary.js'),
        mml_template = require('js/tpl/instruments/Fluke289/Fluke289MinMaxLogSummary.js');

    return Backbone.View.extend({

        initialize: function (options) {

            if (!linkManager.isRecording())
                linkManager.stopLiveStream();

            linkManager.on('input', this.showInput, this);
            this.deviceLogs = this.collection;
            this.logtoDownloadData = null;
            this.currentLog = null;
            this.currentLogIndex = -1;

        },

        render: function () {
            this.$el.html(template());
            // The link manager is always connected when we initialize (main.js makes sure of that)
            // so we send a few commands to initialize the contents of the display:
            linkManager.driver.getMemInfo();

            // Now, we only want to scroll the table, not the whole page:
            var tbheight = window.innerHeight - $('.header .container').height() - 20;
            $('#tablewrapper', this.el).css('max-height',
                tbheight + 'px'
            );

            return this;
        },

        onClose: function () {
            //linkManager.off('input', this.showInput, this);
            linkManager.off(null, null, this);

        },

        events: {
            "click .trendlog": "dlTrendlog",
            "click .start-download": "startDownload",
        },

        showInput: function (data) {
            var self = this;
            console.log("Fluke289 Log Mgt view input processing");
            if (data.memlevel) {
                var span = $('#memlevel', this.el);
                span.html(data.memlevel);
                switch (data.memlevel) {
                case 'OK':
                    span.addClass("label-success").removeClass("label-warning").removeClass("label-important");
                    break;
                default:
                    span.removeClass("label-success").removeClass("label-warning").removeClass("label-important");
                }
            }

            if (data.savedlogs) {
                _.each(data.savedlogs, function (value, key) {
                    $('#mem' + key, self.el).html(value);
                    // Then query information about each of those logs
                    var i = 0;
                    if (key == "record") {
                        while (i < value)
                            linkManager.sendCommand('QRSI ' + i++);
                    } else if (key == "minmax") {
                        while (i < value)
                            linkManager.sendCommand('QMMSI ' + i++);
                    }

                });
            }

            if (data.recordingID) { // recordingID means Trendlog recording
                // 2 possibilities: either a summary, or a record
                var fields = data.recordingID.split(',');
                if (fields.length == 1) {
                    // This is a trendlog recording sumary: add a summary card for it                    
                    var startStamp = data.startTime;
                    var knownLog = this.deviceLogs.where({
                        startstamp: startStamp
                    });
                    // A given device can only record one log at a time, so if we already have a log for this device
                    // in our database, that starts at the same time as this one, we can safely assume this means that
                    // we already downloaded this log
                    data.alreadyThere = "<em>New log<sm>";
                    if (knownLog.length > 0)
                        data.alreadyThere = '<strong><a href="#displaylogs/' + knownLog[0].get('instrumentid') + '/' + knownLog[0].id + '">This log is already downloaded</a><strong>';
                    data.utils = utils; // Need to pass the "utils" object to the scope of the template too, since we use it inside.
                    $('#records', this.el).append(tls_template(data));
                } else {
                    // We just received a log entry for a Trendlog recording we are downloading: save it and request the
                    // next log entry

                    // Update the progress bar:
                    $('#downloadbar', this.el).width(this.currentLogIndex / this.logtoDownloadData.records * 100 + "%");
                    var stamp = data.record.startTime;
                    this.currentLog.entries.create({
                        timestamp: stamp,
                        data: data.record,
                        // Note: logsessionid is only really necessary when running
                        // in Chrome mode, because with indexeddb, we use one single large
                        // DB for all log entries, with the log session ID so differentiate
                        // all the logs:
                        logsessionid: this.currentLog.id
                    });
                    if (self.currentLogIndex < self.logtoDownloadData.records) {
                        linkManager.driver.getTrendlogRecord(self.logtoDownloadData.address, self.currentLogIndex++);
                    } else {
                        $('.start-download', self.el).html("Done&nbsp;!").attr('disabled', 'disabled');
                    }
                }
            }

            if (data.minmaxRecordingID) { // recordingID means Trendlog recording
                // This is a MinMax sumary: add a summary card for it
                $('#minmaxs', this.el).append(mml_template(data));
            }
        },

        dlTrendlog: function (event) {
            $('#logname').val($(event.currentTarget).data('name'));
            this.logtoDownloadData = $(event.currentTarget).data();
            $('.start-download', this.el).html("Start download").attr('disabled', false);
            $('#downloadbar', this.el).width("0%");
            $('#logModal').modal('show');
            return false;
        },

        startDownload: function (event) {
            var self = this;
            this.currentLog = new Devicelog.Log();
            this.currentLog.set('name', $('#logname', this.el).val());
            this.currentLog.set('description', $('#description', this.el).val());
            this.currentLog.set('startstamp', this.logtoDownloadData.start);
            this.currentLog.set('endstamp', this.logtoDownloadData.end);
            if (this.logtoDownloadData.type == "trendlog")
                this.currentLog.set('logtype', 'trendlog');
            this.deviceLogs.add(this.currentLog);
            // Now, initiate log download:
            this.currentLogIndex = 0;
            this.currentLog.save(null, {
                success: function () {
                    self.currentLog.updateEntriesURL(); // Somehow this is required ??
                    self.currentLog.entries.fetch({
                        success: function () {
                            linkManager.driver.getTrendlogRecord(self.logtoDownloadData.address, self.currentLogIndex++);
                        }
                    });
                }
            });
            return false;
        },

    });

});