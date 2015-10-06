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
 * Live view display of the output of the Onyx
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */

define(function (require) {
    "use strict";

    var $ = require('jquery'),
        _ = require('underscore'),
        Backbone = require('backbone'),
        utils = require('app/utils'),
        simpleplot = require('app/lib/flotplot'),
        template = require('js/tpl/instruments/blueonyx/LiveView.js');

    // Load the flot library & flot time plugin:
    require('flot');
    require('flot_time');
    require('flot_resize');


    return Backbone.View.extend({

        initialize: function (options) {

            this.currentDevice = null;
            this.showstream = settings.get('showstream');

            this.deviceinitdone = false;
            this.plotavg = false;

            // TODO: this breaks on Chrome apps due to their inflexible content security
            // policy (we can't inject Javascript in the DOM).
            // We want to dynamically load the Google Maps API at this point:
            $.getScript('https://maps.googleapis.com/maps/api/js?sensor=true&callback=onGMapReady');

            // Get frequency and span if specified:
            var span = this.model.get('liveviewspan'); // In seconds
            var period = this.model.get('liveviewperiod'); // Polling frequency

            var livepoints = 300; // 5 minutes @ 1 Hz
            if (span && period) {
                livepoints = span / period;
            }

            // We will pass this when we create plots, this is the global
            // config for the look and feel of the plot
            this.plotoptions = {
                points: livepoints,
                vertical_stretch: false,
                plot_options: {
                    xaxis: {
                        mode: "time",
                        show: true,
                        timeformat: "%H:%M",
                        timezone: settings.get("timezone")
                    },
                    grid: {
                        hoverable: true
                    },
                    legend: {
                        position: "ne"
                    }
                }

            };

            // Keep an array for moving average over the last X samples
            // In Live view, we fix this at 1 minute. In log management, we will
            // make this configurable
            this.movingAvgPoints = 60;
            this.movingAvgData = []; // Note: used for the graph, this stores the result of the moving average

            this.prevStamp = 0;

            linkManager.on('status', this.updatestatus, this);
            linkManager.on('input', this.showInput, this);

        },


        events: {
            "click #setdevicetag": "setdevicetag",
        },

        render: function () {
            var self = this;
            console.log('Main render of Onyx live view');
            $(this.el).html(template());

            // Remove all the contents of the raw data stream if we don't want it
            // (hiding it is not enough to make it disappear from the layout (it will take
            // room and show as empty space, very noticeable on phones/tablets).
            if (!this.showstream) {
                $("#showstream", this.el).empty();
            }

            this.addPlot();

            if (typeof (google) == 'undefined') {
                console.log('Error: Google maps API did not load');
                $('.map_container', this.el).html('<h4>Maps are unavailable</h4>');
            } else {
                var mapOptions = {
                    zoom: 4,
                    center: new google.maps.LatLng(32, -60),
                    mapTypeId: google.maps.MapTypeId.ROADMAP
                };
                var map = new google.maps.Map($('.map_container', this.el)[0], mapOptions);

            }
            // Now we want the map element to autostretch. A bit of queries and trickery here,
            // so that we resize exactly to the correct height:
            // - We know our offset (below the home view buttons) within the window ($(self.el).offset().top)
            // - We know the size of the chart: $('.geigerchart',self.el).parent().height()
            //     Note: .parent() is the enclosing .thumbnail
            // - Then, we know the size of the numview: $('#numview').height();
            // - Last, remove 60 pixels to account for all the margins around the map/divs/thumbnails
            // ... now do the equation
            $('.map_container', this.el).css('height', $(this.el).parent().css('height'));
            var self = this;
            var rsc = function () {
                var chartheight = $('#geigerchart_row', self.el).outerHeight();
                var numviewheight = $('#numview').outerHeight();
                var mapheight = window.innerHeight - $(self.el).offset().top - chartheight - numviewheight - 60;
                $('.map_container', self.el).css('height', mapheight + 'px');
            }
            this.rsc = rsc;
            $(window).on('resize', this.rsc);
            rsc();
            return this;
        },

        addPlot: function () {
            var self = this;
            this.plot = new simpleplot({
                model: this.model,
                settings: this.plotoptions
            });
            if (this.plot != null) {
                $('.geigerchart', this.el).append(this.plot.el);
                this.plot.render();
            }
        },

        clear: function () {
            $('.geigerchart', this.el).empty();
            this.addPlot();
            this.suspendGraph = true;
        },

        onClose: function () {
            console.log("Onyx live view closing...");

            linkManager.off('status', this.updatestatus);
            linkManager.off('input', this.showInput);
            this.plot.onClose();

        },

        movingAverager: function (newpoint, buffer) {

            buffer.push(newpoint);

            // Keep our data to the length we want
            if (buffer.length >= this.movingAvgPoints)
                buffer = buffer.slice(1);

            // Now compute the average
            var avg = 0;
            for (var i = 0; i < buffer.length; i++) {
                avg += buffer[i];
            }
            return avg / buffer.length;

        },

        updatestatus: function (data) {
            // Either the port is open and we have not done our device init,
            // or the port is closed and we have to reset the device init status
            if (data.portopen && !this.deviceinitdone) {
                linkManager.driver.ping();
            } else if (!data.portopen) {
                this.deviceinitdone = false;
            }
        },

        disp_cpm: function (data, ts) {
            if (data.cpm != undefined) {
                var cpm = parseFloat(data.cpm.value);

                var dp = {
                    name: "CPM",
                    value: cpm,
                    timestamp: ts
                };

                this.plot.appendPoint(dp);
                dp = {
                    name: "AVG",
                    value: this.movingAverager(cpm, this.movingAvgData),
                    timestamp: ts
                }
                this.plot.appendPoint(dp);
            }
        },

        // We get there whenever we receive something from the serial port
        showInput: function (data) {
            var self = this;

            if (data.replay_ts != undefined) {
                this.suspend_graph = false;
                this.disp_cpm(data.data, data.replay_ts);
                return;
            }

            // We're waiting for a data replay
            if (this.suspend_graph)
                return;

            if (this.showstream) {
                // Update our raw data monitor
                var i = $('#input', this.el);
                var scroll = (i.val() + JSON.stringify(data) + '\n').split('\n');
                // Keep max 50 lines:
                if (scroll.length > 50) {
                    scroll = scroll.slice(scroll.length - 50);
                }
                i.val(scroll.join('\n'));
                // Autoscroll:
                i.scrollTop(i[0].scrollHeight - i.height());
            }

            this.disp_cpm(data);
        },
    });
});