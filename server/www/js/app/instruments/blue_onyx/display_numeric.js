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
 * Display output of Geiger counter in numeric format
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */

define(function (require) {
    "use strict";

    var $ = require('jquery'),
        _ = require('underscore'),
        Backbone = require('backbone'),
        utils = require('app/utils'),
        template = require('js/tpl/instruments/blueonyx/NumView.js');


    return Backbone.View.extend({

        initialize: function (options) {
            this.sessionStartStamp = new Date().getTime();
            this.maxreading = 0;
            this.minreading = -1;
            this.valid = false;
            this.validinit = false;
            linkManager.on('input', this.showInput, this);
        },

        events: {},

        render: function () {
            var self = this;
            console.log('Main render of Blue Onyx numeric view');
            this.$el.html(template());
            // We need to force the Live view to resize the map at this
            // stage, becaure we just changed the size of the numview
            if (instrumentManager.liveViewRef() && instrumentManager.liveViewRef().rsc) {
                instrumentManager.liveViewRef().rsc();
            };

            // Cache the query for energy efficiency/memory efficiency
            this.batt_icon = $('#batteryempty', this.el);
            this.lat_span = $('#lat', this.el);
            this.lon_span = $('#lon', this.el);
            this.valid_label = $('#readingvalid', this.el);
            this.cpm_span = $('#livecpm', this.el);
            this.usv_span = $('#liveusvh', this.el);
            return this;
        },

        onClose: function () {
            console.log("Blue Onyx numeric view closing...");
            linkManager.off('input', this.showInput, this);
        },

        showInput: function (data) {

            if (typeof (data.cpm) == 'undefined')
                return;
            var cpm = parseFloat(data.cpm.value);
            var usv = parseFloat(data.cpm.usv);
            var count = parseInt(data.cpm.count);
            this.cpm_span.html(cpm.toFixed(0));
            if (usv) {
                this.usv_span.html(usv.toFixed(3) + "&nbsp;&mu;Sv/h");
            }

            if (!data.batt_ok) {
                this.batt_icon.show();
            } else {
                this.batt_icon.hide();
            }

            if (data.loc_status && data.loc_status == 'OK') {
                var coord = utils.coordToString({
                    lat: data.loc.coords.latitude,
                    lng: data.loc.coords.longitude
                });
                this.lat_span.html(coord.lat);
                this.lon_span.html(coord.lng);
            } else if (data.loc_status) {
                this.lat_span.html('GPS: ' + data.loc_status);
                this.lon_span.html('');
            }

            // Create a blinking effect to indicate that we received data:
            this.valid_label.addClass('label-info').removeClass('label-danger').removeClass('label-success');
            setTimeout(function () {
                this.valid_label.removeClass('label-info');
                if (data.cpm.valid)
                    this.valid_label.removeClass('label-danger').addClass('label-success').html('OK');
                else
                    this.valid_label.removeClass('label-success').addClass('label-danger').html('V');
            }, 250);

        },


    });
});