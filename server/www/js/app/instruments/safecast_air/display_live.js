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
 * Live view display of the output of the Safecast Air. Graphs all gas sensors
 * for now.
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
        template = require('js/tpl/instruments/safecast_air/LiveView.js');

    return Backbone.View.extend({

        initialize: function (options) {

            var self = this;

            this.map = null;
            this.lastMarker = null;

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
            this.display_graph = true;
            if (vizapp.type == 'cordova') {
                var wz_settings = instrumentManager.getInstrument().get('wizkers_settings');
                if (wz_settings) {
                    if (wz_settings.display_gmaps == 'true')
                        this.display_map = true;
                    if (wz_settings.display_graph == 'false')
                        this.display_graph = false;
                    if (wz_settings.screen_no_dim == 'true') {
                        keepscreenon.enable();
                    } else {
                        keepscreenon.disable();
                    }
                } else {
                    // Happens when the user never explicitely set the map option
                    this.display_map = true;
                }
            }

            // We will pass this when we create plots, this is the global
            // config for the look and feel of the plot
            this.plotoptions = {
                points: livepoints,
                vertical_stretch_parent: true,
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

            // Keep track of the readings we detected, and keep a reference to the
            // plots where they are displayed.
            this.probes = {};

            // Keep an array for moving average over the last X samples
            // In Live view, we fix this at 1 minute. In log management, we will
            // make this configurable
            this.movingAvgPoints = 60;
            this.movingAvgData = []; // Note: used for the graph, this stores the result of the moving average

            linkManager.on('status', this.updatestatus, this);
            linkManager.on('input', this.showInput, this);

        },

        render: function () {
            var self = this;
            console.log('Main render of Safecast Air live view');
            this.$el.html(template());

            // Remove all the contents of the raw data stream if we don't want it
            // (hiding it is not enough to make it disappear from the layout (it will take
            // room and show as empty space, very noticeable on phones/tablets).
            if (!this.showstream) {
                $("#showstream", this.el).empty();
            }

            // If we dont' want the maps, then modify the style of the graph to make sure
            // it occupies the whole space:
            if (!this.display_map) {
                $('#map_row', this.el).empty();
            }

            if (!this.display_graph) {
                $('#geigerchart_row', this.el).empty();
            }


            if (this.display_graph)
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
                    // - Last, remove 50 pixels to account for all the margins around the map/divs/thumbnails
                    // ... now do the equation
                    var self = this;
                    var rsc = function () {
                        // We want the chart to be 16% of the screen
                        if (self.display_graph) {
                            self.$('.geigerchart').height(window.innerHeight * 0.16);
                            if (self.plot && self.plot.rsc)
                                self.plot.rsc();
                        }
                        var chartheight = $('#geigerchart_row', self.el).outerHeight();
                        var numviewheight = 0;
                        // We want to take the numview height into account if screen is xs or sm
                        if (utils.checkBreakpoint('xs') || utils.checkBreakpoint('sm'))
                            numviewheight = $('#numview').outerHeight();
                        var mapheight = window.innerHeight - $(self.el).offset().top - chartheight - numviewheight - 50;
                        if (mapheight < 50) {
                            self.$('#map_row').hide();
                            // Readjust the graph to take the rest of the space:
                            var chartheight = window.innerHeight - $(self.el).offset().top - numviewheight - 50;
                            self.$('.geigerchart').height(chartheight);
                            // Then tell the chart to resize itself
                            if (self.plot && self.plot.rsc)
                                self.plot.rsc();
                        } else {
                            self.$('#map_row').show();
                            $('.map_container > .mapwidget', self.el).height(mapheight);
                            self.map.resize(mapheight);
                        }
                    }
                    if (this.rsc)
                        $(window).off('resize', this.rsc);
                    this.rsc = rsc;
                    $(window).on('resize', this.rsc);
                    rsc();
                }
            } else {
                // Implement a resizer for the Geiger chart only
                if (!this.display_graph)
                    return;
                var self = this;
                var rsc = function () {
                    var numviewheight = 0;
                    // We want to take the numview height into account if screen is xs or sm
                    if (utils.checkBreakpoint('xs') || utils.checkBreakpoint('sm'))
                        numviewheight = $('#numview').outerHeight();
                    var chartheight = window.innerHeight - $(self.el).offset().top - numviewheight - 55;
                    $('.geigerchart', self.el).css('height', chartheight + 'px');
                    // Then tell the chart to resize itself
                    if (self.plot && self.plot.rsc)
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
            this.probes['All'] = new simpleplot({
                model: this.model,
                settings: this.plotoptions
            });
            if (this.probes['All'] != null) {
                $('.geigerchart', this.el).append(this.probes['All'].el);
                this.probes['All'].render();
            }
        },

        clear: function () {
            $('.geigerchart', this.el).empty();
            this.addPlot();
            this.suspendGraph = true;
        },

        selectProbe: function (evt) {
            var pid = $(evt.target).data('probe');
            // We need to tell the num view we got a new probe ID:
            instrumentManager.numViewRef().selectProbe(pid);
        },


        onClose: function () {
            console.log("Blue Onyx live view closing");
            linkManager.off('status', this.updatestatus);
            linkManager.off('input', this.showInput);
            if (this.rsc)
                $(window).off('resize', this.rsc);
            if (this.plot)
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
            if (!this.display_graph)
                return;

            if (data.cpm != undefined) {
                var cpm = parseFloat(data.cpm.value);

                var dp = {
                    name: "CPM",
                    value: cpm,
                    timestamp: ts
                };
                (typeof ts != 'undefined') ? this.plot.fastAppendPoint(dp): this.plot.appendPoint(dp);
                dp = {
                    name: "AVG",
                    value: this.movingAverager(cpm, this.movingAvgData),
                    timestamp: ts
                };
                (typeof ts != 'undefined') ? this.plot.fastAppendPoint(dp): this.plot.appendPoint(dp);
            }
        },

        // We get there whenever we receive something from the driver port
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

            if (data.gps == undefined)
                return;

            var image = 'darkOrange.png';
            // Now update the map (if it exists) to show the current location/measurement
            if (this.map) {
                if (this.lastMarker == null) {
                    this.lastMarker = {
                        lat: data.gps.lat,
                        lng: data.gps.lon,
                        icon: 'js/app/instruments/blue_onyx/markers/' + image
                    };
                    this.map.addMarker(this.lastMarker);
                    this.map.setCenter(data.loc.coords.latitude, data.loc.coords.longitude);
                }

                // We want to add points/markers to the line of logging at points every 15 meters
                var d = utils.CoordDistance({
                        lat: data.loc.coords.latitude,
                        lng: data.loc.coords.longitude
                    },
                    this.lastMarker);
                if (d > 15 / 1000) {
                    this.lastMarker = {
                        lat: data.loc.coords.latitude,
                        lng: data.loc.coords.longitude,
                        icon: 'js/app/instruments/blue_onyx/markers/' + image
                    };
                    this.map.addMarker(this.lastMarker);
                    // Only recenter the map if we moved significantly, otherwise the API makes
                    // useless calls to the Google servers, wasting quota + bandwidth
                    this.map.setCenter(data.loc.coords.latitude, data.loc.coords.longitude);
                }
            }

            if (data.gas) {
                // Add the gas reading values to the graph. We are creating a different
                // graph for each gas reading
                for (type in data.gas) {
                    if (!this.probes.hasOwnProperty(type)) {
                        this.probes[type] = new simpleplot({
                            model: this.model,
                            settings: this.plotoptions
                        });

                        $('#probes-select', this.el).append('<li role="presentation" class="probe-tab" ><a data-toggle="tab" href="#probes-' + type + '" data-probe="' + type + '">' + types + '</a></li>');
                        $('#probes-content', this.el).append('<div class="tab-pane" id="probes-' + type + '"><div class="thumbnail">' +
                            '<div class="chart" id="chart-' + type + '"></div></div></div>');
                        // Need to activate the tab before adding the plot, otherwise we get a "invalid plot dimensions" error
                        // when rendering the plot
                        $('#probes-select a:last', this.el).tab('show');
                        $('#chart-' + type, this.el).append(this.probes[type].el);
                        this.probes[type].render();
                        instrumentManager.numViewRef().selectProbe(type);
                    }
                    // By now we know we have a proper graph to add the gas reading to:
                    var rdng = parseFloat(data.gas.ppbFlt);
                    var datapoint = {
                        'name': type,
                        'value': rdng
                    };
                    this.probes[type].appendPoint(datapoint);
                }
            }

            //            this.disp_cpm(data);
        },
    });
});