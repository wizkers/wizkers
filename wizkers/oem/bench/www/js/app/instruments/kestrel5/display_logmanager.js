/**
 * This file is part of Wizkers.io
 *
 * The MIT License (MIT)
 *  Copyright (c) 2017 Edouard Lafargue, ed@wizkers.io
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

/**
 * Log management for Kestrel devices
 *
 * @author Edouard Lafargue, ed@wizkers.io
 */


define(function (require) {
    "use strict";

    var $ = require('jquery'),
        _ = require('underscore'),
        Backbone = require('backbone'),
        Devicelog = require('app/models/devicelog'),
        template = require('js/tpl/instruments/kestrel5/LogManagementView.js');

    return Backbone.View.extend({

        initialize: function (options) {
            linkManager.on('input', this.showInput, this);
            this.deviceLogs = this.collection; // The logs are already loaded from the server
            this.instrument = instrumentManager.getInstrument();

            // A couple of variables we need to keep track of incoming logs:
            this.log_index = 0;
            this.log_size = 0;
            this.entries = [];
        },

        render: function () {
            this.$el.html(template());
            return this;
        },

        onClose: function () {
            linkManager.off('input', this.showInput);

        },

        events: {
            "click .downloadlog": "downloadlog",
            "click .start-download": "startDownload",
        },


        /**
         * Display the log download modal and ask the device for its log
         */
        downloadlog: function (event) {
            $('#logModal', this.el).modal();
            return false;
        },

        /**
         * Triggers the actual download
         */
        startDownload: function (event) {
            this.$('.start-download').text('Downloading').attr('disabled', true);
            this.$('#op_status').html('Opening device logs...');
            linkManager.sendCommand({ command: 'download_log'});
            return false;
        },

        saveLog: function (data) {
            console.log("Saving Kestrel5 log");
            var self = this;

            var points = this.entries;
            // Phase I: check if this log is already stored and we need to append to it, or if
            // this is a new log. We do this by checking the timestamp of the 1st
            // point, and see if it exists in the database:
            var firststamp = new Date(points[0].timestamp).getTime(); // Timestamps are stored as Javascript timestamps
            var knownLog = this.deviceLogs.where({
                startstamp: firststamp
            });

            var currentLog = null;
            var newPoints = 0;
            if (knownLog.length > 0) { // We already have a log starting there.
                if (knownLog.length > 1)
                    alert('Oops: we have multiple logs for the device starting at the same time, this is a bug.');
                // The incoming log is the continuation of a log we already
                // know about (i.e. the log was not cleared since last download)
                currentLog = knownLog[0];
            }

            if (currentLog == null) {
                // We don't know this log: create a new session
                currentLog = new Devicelog.Log();
                this.deviceLogs.add(currentLog);
                currentLog.set('startstamp', new Date(points[0].timestamp).getTime());
                // The type is purely arbitrary: we are using the type "onyxlog" for
                // logs that are downloaded from the Onyx device
                currentLog.set('logtype', 'kestrel5log');
            }
            currentLog.set('endstamp', new Date(points[points.length - 1].timestamp).getTime());
            currentLog.save(null, {
                success: function () {
                    // For some reason, the 'sync' Backbone even that is fired upon data
                    // save fires too late - so the updateEntriesURL callback is not called
                    // yet by the time we're here, and our entries URL is not updated yet.
                    // for this reason, we need to call it explicitely here:
                    currentLog.updateEntriesURL();
                    // We now gotta fetch all existing log entries for the log so that
                    // we don't create duplicates
                    currentLog.entries.fetch({
                        success: function () {
                            // Phase II: We now have our log ID, let's save all the log
                            // entries:
                            for (var i = 0; i < points.length; i++) {
                                var pointStamp = new Date(points[i].timestamp).getTime();
                                // Don't overwrite existing entries:
                                var logEntry = currentLog.entries.where({
                                    timestamp: pointStamp
                                });
                                if (logEntry.length == 0) {
                                    newPoints++;
                                    currentLog.entries.create({
                                        timestamp: pointStamp,
                                        data: points[i].data,
                                        // Note: logsessionid is only really necessary when running
                                        // in Chrome mode, because with indexeddb, we use one single large
                                        // DB for all log entries, with the log session ID so differentiate
                                        // all the logs:
                                        logsessionid: currentLog.id
                                    });
                                }
                            }
                            $('#logModal .modal-body', self.el).html('<p>Log downloaded.</p><p>New data points:' + newPoints + '.</p>');
                            $('#logDismissOK', self.el).removeAttr('disabled');
                        }
                    });
                }
            });
        },


        showInput: function (data) {
            if (data.log_size != undefined && data.log_size > 0) {
                // We receive this message at start of log download
                console.info('[Kestrel Log Manager] Start of log download', data.log_size);
                this.$('#op_status').html('Receiving logs...');
                this.log_size = data.log_size;
                this.log_index = 0;
                return;
            }

            if (data.log != undefined) {
                // We have an incoming log entry
                // log entries are formatted as:
                // log: { timestamp: date, data: { fields }}
                $('#downloadbar', this.el).width(this.log_index++ / this.log_size * 100 + "%");
                this.entries.push({
                    timestamp: data.log.timestamp,
                    data: data.log.data,
                });
                return;
            }

            if (data.log_xfer_done) {
                this.saveLog();
                $('.start-download', self.el).html("Done&nbsp;!").attr('disabled', 'disabled');
            }
        }
    });
});