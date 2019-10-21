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
 * Live view display of the output of the Onyx. This live view is used
 * by most Geiger instruments and is very configurable.
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */

define(function (require) {
    "use strict";

    var $ = require('jquery'),
        _ = require('underscore'),
        Backbone = require('backbone'),
        utils = require('app/utils'),
        template = require('js/tpl/instruments/nmea/LiveView.js');

    return Backbone.View.extend({

        initialize: function (options) {

            this.currentDevice = null;
            this.deviceinitdone = false;
            this.display_map = false;
            this.prnlist = {};

            if (vizapp.type == 'cordova') {
                var wz_settings = instrumentManager.getInstrument().get('wizkers_settings');
                if (wz_settings) {
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

            linkManager.on('status', this.updatestatus, this);
            linkManager.on('input', this.showInput, this);

        },

        render: function () {
            var self = this;
            console.log('Main render of NMEA live view');
            this.$el.html(template());
            this.$('#prntable').append('<tr><th>PRN</th><th>S/N</th><th>Constellation</th><th>Used</th></tr>');

            return this;
        },

        onClose: function () {
            console.log("NMEA live view closing...");
            linkManager.off('status', this.updatestatus);
            linkManager.off('input', this.showInput);
        },

        disp_prn: function (data) {
            var constellations = [ 'GPS', 'SBAS', 'Galileo', 'Beidou', 'IMES', 'QZSS', 'GLONASS'];
            var line = this.$('#prntable #PRN' + data.PRN);
            if (line.length) {
                // Update an existing table line
                var ss = $('.ss', line[0]);
                if (data.ss != parseInt(ss.html())) {
                    ss.css('color', (data.ss >= parseInt(ss.html())) ? 'green' : 'red');
                    ss.html(data.ss);
                    setTimeout(function() { ss.css('color','');
                    },200);
                }
                var used = $('.used', line[0]);
                used.html('' + data.used);
                if (!data.used) {
                    $(line[0]).css('background', '#dedada');
                } else {
                    $(line[0]).css('background', '');
                }
            } else {
                this.$('#prntable').append('<tr id="PRN' + data.PRN + '"><td class="PRN">' + data.PRN + '</td>' +
                                            '<td class="ss">' + data.ss + '</td>' +
                                            '<td class="gnssid">' + constellations[data.gnssid] + '</td>' +
                                            '<td class="used">' + data.used + '</td></tr>');
            }
        },

        // We get there whenever we receive something from the serial port
        // Note: data is in JSON
        showInput: function(data) {
            var self = this;
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

            if (data.class) {
                if ( data.class == "SKY") {
                    // Work on a clone of the satellites array, otherwise other consumers
                    // of the SKY message will get a damaged array
                    var sats = Array.from(data.satellites);
                    // Populate/update the PRN table.
                    // In order to minimize redraws, we first update lines
                    // that we already have, delete any PRN that has disappeared
                    // and last, add any remaining PRN in the satellites list                    
                    this.$('#prntable tr').each(function(index, element) {
                        var id = $(element).attr('id');
                        if (id != undefined) {
                            var prn = parseInt(id.substr(3));
                            var idx = sats.findIndex(function(item) {return item.PRN == prn;});
                            if (idx == -1) {
                                // the Sat is not there anymore, delete the row
                                $(element).remove();
                            } else {
                                self.disp_prn(sats[idx]);
                                sats.splice(idx,1);
                            }
                        }
                        });
                    // Now add the remaining satellites that have appeared sine last time:
                    for (var i in sats) {
                        this.disp_prn(sats[i]);
                    }
                } else if (data.class == "TPV") {
                    this.$('#gpstime').html(data.time);
                    var coord = {
                        lat: data.lat,
                        lng: data.lon
                    };
                    var coord_txt = utils.coordToString(coord);
                    this.$('#gpscoords').html(coord_txt.lat + " / " + coord_txt.lng);
                    this.$('#gpsspeed').html(data.speed + "&nbsp;m/s");
                    if (data.mode) {
                        var modes = [ 'label-default', 'label-danger', 'label-primary', 'label-success'];
                        var fixes = [ 'Unknown fix', 'No Fix', '2D Fix', '3D Fix'];
                        this.$('#gpsmode').html(fixes[data.mode]);
                        this.$('#gpsmode').addClass(modes[data.mode]);
                        for (var i in modes) {
                            if (i != data.mode)
                                this.$('#gpsmode').removeClass(modes[i]);
                        }
                    }
                }
            }
        }
    });
});
