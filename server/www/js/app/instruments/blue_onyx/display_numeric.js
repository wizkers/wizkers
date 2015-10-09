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
            console.log('Main render of Onyx numeric view');
            $(this.el).html(template());
            // We need to force the Live view to resize the map at this
            // stage, becaure we just changed the size of the numview
            if (instrumentManager.liveViewRef() && instrumentManager.liveViewRef().rsc) {
                instrumentManager.liveViewRef().rsc();
            };
            return this;
        },

        onClose: function () {
            console.log("Onyx numeric view closing...");
            linkManager.off('input', this.showInput, this);
        },

        showInput: function (data) {

            if (typeof (data.devicetag) != 'undefined')
                $('#devicetag', this.el).html(data.devicetag);

            if (typeof (data.cpm) == 'undefined')
                return;
            var cpm = parseFloat(data.cpm.value);
            var usv = parseFloat(data.cpm.usv);
            var count = parseInt(data.cpm.count);
            $('#livecpm', this.el).html(cpm.toFixed(0));
            if (usv) {
                $('#liveusvh', this.el).html(usv.toFixed(3) + "&nbsp;&mu;Sv/h");
            }
            
            if (data.loc_status && data.loc_status == 'OK') {
                var coord = utils.coordToString({ lat: data.loc.coords.latitude, lng: data.loc.coords.longitude});
                $('#lat', this.el).html(coord.lat);
                $('#lon', this.el).html(coord.lng);
            } else if (data.loc_status) {
                $('#lat',this.el).html('GPS: ' + data.loc_status);
                $('#lon',this.el).html('');
            }

            // Create a blinking effect to indicate that we received data:
            $('#readingvalid', this.el).addClass('label-info').removeClass('label-danger').removeClass('label-success');
            setTimeout(function () {
                $('#readingvalid',this.el).removeClass('label-info');
                if (data.cpm.valid)
                    $('#readingvalid', this.el).removeClass('label-danger').addClass('label-success').html('VALID');
                else
                    $('#readingvalid', this.el).removeClass('label-success').addClass('label-danger').html('INVALID');
            }, 250);

        },


    });
});