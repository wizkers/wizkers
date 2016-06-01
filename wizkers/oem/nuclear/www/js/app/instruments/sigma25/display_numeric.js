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
/*
 * Controls for Sigma25
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */

define(function (require) {
    "use strict";

    var $ = require('jquery'),
        _ = require('underscore'),
        Backbone = require('backbone'),
        utils = require('app/utils'),
        template = require('js/tpl/instruments/sigma25/Sigma25NumView.js');

    return Backbone.View.extend({

        initialize: function (options) {
            linkManager.on('input', this.showInput, this);
        },

        events: {
        },

        render: function () {
            var self = this;
            console.log('Main render of Sigma25 numeric view');
            this.$el.html(template());
            return this;
        },

        onClose: function () {
            console.log("Sigma25 numeric view closing...");
            linkManager.off('input', this.showInput, this);
        },

        showInput: function (data) {
            if (data.channels)
                return;
            
            if (data.gain != undefined) {
                $('#gain', this.el).val(parseInt(data.gain,10));
                linkManager.sendCommand('b');  // Bias
            } else
            if (data.serial != undefined) {
                $('#serial', this.el).val(data.serial);
                linkManager.sendCommand('l');  // LLD Channel
            } else
            if (data.lld_channel != undefined) {
                $('#lld_channel', this.el).val(data.lld_channel);
                linkManager.startLiveStream(this.model.get('liveviewperiod'));
            } else
            if (data.bias != undefined) {
                $('#bias', this.el).val(data.bias);
                linkManager.sendCommand('n');  // Serial number
            }
        
        },


    });
});