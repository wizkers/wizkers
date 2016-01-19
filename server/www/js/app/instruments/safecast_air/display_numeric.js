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
 * Display output of Safecast Air readings in numeric format
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */

define(function (require) {
    "use strict";

    var $ = require('jquery'),
        _ = require('underscore'),
        Backbone = require('backbone'),
        utils = require('app/utils'),
        template = require('js/tpl/instruments/safecast_air/NumView.js');


    return Backbone.View.extend({

        initialize: function (options) {
            this.sessionStartStamp = new Date().getTime();
            this.maxreading = 0;
            this.minreading = -1;
            this.valid = false;
            this.validinit = false;
            this.probeid = '-';
            var readings = {};

            linkManager.on('input', this.showInput, this);
        },

        events: {},

        render: function () {
            var self = this;
            console.log('Main render of bGassy numeric view');
            this.$el.html(template());
            // We need to force the Live view to resize the map at this
            // stage, becaure we just changed the size of the numview
            if (instrumentManager.liveViewRef() && instrumentManager.liveViewRef().rsc) {
                instrumentManager.liveViewRef().rsc();
            };
            if (this.probeid != '-') {
                var pname = instrumentManager.getInstrument().get('metadata').probes[this.probeid].name || this.probeid;
                $("#probeid", this.el).html(pname);
                if (readings[this.probeid] != undefined) {
                    // TODO
                }
            }

            return this;
        },

        onClose: function () {
            console.log("bGassy numeric view closing...");
            linkManager.off('input', this.showInput, this);
        },

        selectProbe: function (pid) {
            probeid = pid;
            this.render();
        },

        showInput: function (data) {

            if (data.replay_ts != undefined)
                return;

            if (data.reconnecting != 'undefined') {
                $('#numview_in', this.el).css('color', data.reconnecting ? '#a1a1a1' : '#000000');
            }

            if (typeof (data.gas) == 'undefined')
                return;

            /**
            readings[data.probeid] = { cpm: cpm, cpm2: cpm2};

            if (data.probeid != probeid)
                return;
            
            $('#livecpm', this.el).html(cpm);
            $('#livecpm2', this.el).html(cpm2);
            $('#liveusvh', this.el).html((parseFloat(data.cpm2.value)/100).toFixed(3));
            */
            
            if (data.gps) {
                var coord = utils.coordToString({
                    lat: data.gps.lat,
                    lng: data.gps.lon
                });
                $('#lat', this.el).html(coord.lat);
                $('#lon', this.el).html(coord.lng);
                $('#sats', this.el).html(data.loc.sats);
            } else if (data.loc_status) {
                $('#lat', this.el).html('GPS: ' + data.loc_status);
                $('#lon', this.el).html('');
            }

            // Create a blinking effect to indicate that we received data:
            $('#readingvalid', this.el).addClass('label-info').removeClass('label-danger').removeClass('label-success');
            setTimeout(function () {
                $('#readingvalid', this.el).removeClass('label-info');
                if (data.cpm.valid)
                    $('#readingvalid', this.el).removeClass('label-danger').addClass('label-success').html('OK');
                else
                    $('#readingvalid', this.el).removeClass('label-success').addClass('label-danger').html('V');
            }, 250);

        },


    });
});