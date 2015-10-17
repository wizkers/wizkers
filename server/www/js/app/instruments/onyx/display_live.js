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
        mapWidget = require('app/lib/mapwidget'),
        template = require('js/tpl/instruments/onyx/OnyxLiveView.js');

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

            // Get frequency and span if specified:
            var span = this.model.get('liveviewspan'); // In seconds
            var period = this.model.get('liveviewperiod'); // Polling frequency

            var livepoints = 300; // 5 minutes @ 1 Hz
            if (span && period) {
                livepoints = span / period;
            }

            this.display_map = false;
            var wz_settings = instrumentManager.getInstrument().get('wizkers_settings');
            if (wz_settings == undefined)
                this.display_map = true;
            else if (wz_settings.display_gmaps == 'true')
                this.display_map = true;

            if (vizapp.type == 'chrome')
                this.display_map = false;


            // We will pass this when we create plots, this is the global
            // config for the look and feel of the plot
            this.plotoptions = {
                points: livepoints,
                vertical_stretch_parent: true
            };

            // Keep an array for moving average over the last X samples
            // In Live view, we fix this at 1 minute. In log management, we will
            // make this configurable
            this.movingAvgPoints = 60;
            this.movingAvgData = []; // Note: used for the graph, this stores the result of the moving average
            this.movingAvgData2 = []; // Note: used for the graph, this stores the result of the moving average

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

            // Hide the raw data stream if we don't want it
            if (!this.showstream) {
                $("#showstream", this.el).empty();
            }

            // If we dont' want the maps, then modify the style of the graph to make sure
            // it occupies the whole space:
            if (!this.display_map) {
                $('#map_row', this.el).empty();
            }

            linkManager.requestStatus();
            this.addPlot();

            if (this.display_map) {
                this.map = new mapWidget();
                if (this.map != null) {
                    $('.map_container', this.el).append(this.map.el);
                    this.map.render();
                    // Now we want the map element to autostretch. A bit of queries and trickery here,
                    // so that we resize exactly to the correct height:
                    // - We know our offset (below the home view buttons) within the window ($(self.el).offset().top)
                    // - We know the size of the chart: $('.geigerchart',self.el).parent().height()
                    //     Note: .parent() is the enclosing .thumbnail
                    // - Then, we know the size of the numview: $('#numview').height();
                    // - Last, remove 55 pixels to account for all the margins around the map/divs/thumbnails
                    // ... now do the equation
                    //$('.map_container', this.el).css('height', $(this.el).parent().css('height'));

                    var self = this;
                    var rsc = function () {
                        var chartheight = $('#geigerchart_row', self.el).outerHeight();
                        var numviewheight = 0;
                        // We want to take the numview height into account if screen is xs or sm
                        if (utils.checkBreakpoint('xs') || utils.checkBreakpoint('sm'))
                            numviewheight = $('#numview').outerHeight();
                        var mapheight = window.innerHeight - $(self.el).offset().top - chartheight - numviewheight - 55;
                        $('.map_container > .map', self.el).css('height', mapheight + 'px');
                        self.map.resize();
                    }
                    if (this.rsc)
                        $(window).off('resize', this.rsc);
                    this.rsc = rsc;
                    $(window).on('resize', this.rsc);
                    rsc();
                }
            } else {
                // Implement a resizer for the Geiger chart only
                var self = this;
                var rsc = function () {
                    var numviewheight = 0;
                    // We want to take the numview height into account if screen is xs or sm
                    if (utils.checkBreakpoint('xs') || utils.checkBreakpoint('sm'))
                        numviewheight = $('#numview').outerHeight();
                    var chartheight = window.innerHeight - $(self.el).offset().top - numviewheight - 55;
                    $('.geigerchart', self.el).css('height', chartheight + 'px');
                    // Then tell the chart to resize itself
                    if (self.plot)
                        self.plot.rsc();
                }
                if (this.rsc)
                    $(window).off('resize', this.rsc);
                this.rsc = rsc;
                $(window).on('resize', this.rsc);
                rsc();
            }


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
                buffer.shift();

            // Now compute the average
            var avg = 0;
            for (var i = 0; i < buffer.length; i++) {
                avg += buffer[i];
            }
            return avg / buffer.length;

        },

        setdevicetag: function () {
            var tag = $('#devicetagfield', this.el).val();
            linkManager.driver.setdevicetag(tag);
            $('#dtModal', this.el).modal('hide');
            // Need a small delay to let the Onyx store the tag
            setTimeout(linkManager.driver.devicetag, 300);
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
                    'name': "CPM",
                    'value': cpm,
                    'timestamp': ts
                };

                this.plot.appendPoint(dp);
                dp = {
                    'name': "AVG",
                    'value': this.movingAverager(cpm, this.movingAvgData),
                    'timestamp': ts
                }
                this.plot.appendPoint(dp);
            }
            if (data.cpm2 != undefined) {
                var cpm2 = parseFloat(data.cpm2.value);
                var dp = {
                    'name': "CPM2",
                    'value': cpm2,
                    'timestamp': ts
                };
                this.plot.appendPoint(dp);
                dp = {
                    'name': "AVG2",
                    'value': this.movingAverager(cpm2, this.movingAvgData2),
                    'timestamp': ts
                };
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

            // Have we read all we need from the device?
            if (!this.deviceinitdone) {
                linkManager.driver.devicetag();
            }

            if (data.rtc != undefined) {
                var date = new Date(parseInt(data.rtc) * 1000);
                if (date.getFullYear() < new Date().getFullYear()) {
                    // We have a RTC that is wrong, need to sync it.
                    linkManager.driver.settime();
                    $('#stModal', this.el).modal('show');
                }
            }

            if (data.devicetag != undefined) {
                this.deviceinitdone = true;
                if (data.devicetag == "No device tag set") {
                    // Show the device tag set dialog
                    $('#dtModal', this.el).modal('show');
                } else {
                    linkManager.driver.getRTC();
                    linkManager.startLiveStream(this.model.get('liveviewperiod'));
                }
            } else {

                var cpm = parseFloat(data.cpm.value);
                var image = 'white.png';
                if (cpm >= 1050) {
                    image = 'grey.png';
                } else if (cpm >= 680) {
                    image = 'darkRed.png';
                } else if (cpm >= 420) {
                    image = 'red.png';
                } else if (cpm >= 350) {
                    image = 'darkOrange.png';
                } else if (cpm >= 280) {
                    image = 'orange.png';
                } else if (cpm >= 175) {
                    image = 'yellow.png';
                } else if (cpm >= 105) {
                    image = 'lightGreen.png';
                } else if (cpm >= 70) {
                    image = 'green.png';
                } else if (cpm >= 35) {
                    image = 'midgreen.png'
                }

                if (this.map && data.loc_status && data.loc_status == 'OK') {
                    this.map.setCenter(data.loc.coords.latitude, data.loc.coords.longitude);
                    if (this.lastMarker == null) {
                        this.lastMarker = {
                            lat: data.loc.coords.latitude,
                            lng: data.loc.coords.longitude,
                            icon: 'js/app/instruments/blue_onyx/markers/' + image
                        };

                        this.map.addMarker(this.lastMarker);
                    }

                    // We want to add points/markers to the line of logging at points every 15 meters ?
                    var d = utils.CoordDistance({
                            lat: data.loc.coords.latitude,
                            lng: data.loc.coords.longitude
                        },
                        this.lastMarker);
                    if (d > 15/1000) {
                        this.lastMarker = {
                            lat: data.loc.coords.latitude,
                            lng: data.loc.coords.longitude,
                            icon: 'js/app/instruments/blue_onyx/markers/' + image
                        };
                        this.map.addMarker(this.lastMarker);
                    }
                }

                this.disp_cpm(data);
            }
        },
    });
});