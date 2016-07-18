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

/**
 * Log management for the Onyx device: the Onyx only supports basic log management, namely
 * log downloads & clear
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */


define(function (require) {
    "use strict";

    var $ = require('jquery'),
        _ = require('underscore'),
        Backbone = require('backbone'),
        Devicelog = require('app/models/devicelog'),
        template = require('js/tpl/instruments/onyx/OnyxLogManagementView.js');

    return Backbone.View.extend({

        initialize: function (options) {
            linkManager.on('input', this.showInput, this);
            this.deviceLogs = this.collection; // The logs are already loaded from the server
            this.instrument = instrumentManager.getInstrument();
        },

        render: function () {
            this.$el.html(template());
            linkManager.driver.logstatus();
            return this;
        },

        onClose: function () {
            linkManager.off(null, null, this);

        },

        events: {
            "click .downloadlog": "downloadlog",
        },


        downloadlog: function (event) {
            $('#logModal', this.el).modal();
            linkManager.stopLiveStream();
            linkManager.sendCommand('LOGXFER');
            return false;
        },

        showInput: function (data) {
            if (!isNaN(data.log_size)) {
                this.saveLogSession(data);
            } else
            if (data.logstatus != undefined) {
                var used = data.logstatus.used;
                var total = data.logstatus.total;
                var interval = data.logstatus.interval;
                $('#memdays', this.el).html((used / total * 100).toFixed(0) + "%");
                $('#memused', this.el).html(used);
                $('#memtotal', this.el).html(total);
                $('#meminterval', this.el).html(interval + ' seconds');

                // Now compute how long this is in terms of Days/Hours:
                var time_left = (total - used) * interval / 3600;
                // Make the user's life easier: above 48 hours, display in days/hours
                if (time_left < 49) {
                    $('#timeleft', this.el).html(time_left + " hours");
                } else {
                    var days = Math.floor(time_left / 24).toFixed(0);
                    var hours = Math.floor(time_left % 24).toFixed(0);
                    $('#timeleft', this.el).html(days + " days and " + hours + " hours");
                }
                if (used) {
                    $('.downloadlog', this.el).attr('disabled', false);
                }
            }
        },

        saveLogSession: function (data) {
            console.log("Log transfer incoming...");
            var self = this;

            var points = data.log_data;
            // Phase I: check if this log is already stored and we need to append to it, or if
            // this is a new log. We do this by checking the timestamp of the 1st
            // point, and see if it exists in the database:
            var firststamp = new Date(points[0].time).getTime(); // Timestamps are stored as Javascript timestamps
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
                currentLog.set('startstamp', new Date(points[0].time).getTime());
                // The type is purely arbitrary: we are using the type "onyxlog" for
                // logs that are downloaded from the Onyx device
                currentLog.set('logtype', 'onyxlog');
            }
            currentLog.set('endstamp', new Date(points[points.length - 1].time).getTime());
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
                                var pointStamp = new Date(points[i].time).getTime();
                                // Don't overwrite existing entries:
                                var logEntry = currentLog.entries.where({
                                    timestamp: pointStamp
                                });
                                if (logEntry.length == 0) {
                                    newPoints++;
                                    currentLog.entries.create({
                                        timestamp: pointStamp,
                                        data: points[i],
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


    });
});