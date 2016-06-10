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
        template = require('js/tpl/instruments/slevel_monitor/NumView.js');

    return Backbone.View.extend({

        initialize: function (options) {
            linkManager.on('input', this.showInput, this);
            linkManager.on('status', this.updatestatus, this);
            this.deviceInitDone = false;
        },

        events: {
            "click #qsy": "qsy",
        },

        render: function () {
            var self = this;
            console.log('Main render of S Level numeric view');
            this.$el.html(template());
            return this;
        },

        updatestatus: function(data) {
            if (data.portopen && !this.deviceinitdone) {
            linkManager.driver.getVFO('a');
                this.deviceinitdone = true;
            }
        },

        qsy: function () {
            this.freq = parseFloat($('#vfoa', this.el).val())*1e6;
            this.setVFO(this.freq);
        },
        
        setVFO: function(f) {
            var freq = ("00000000000" + f).slice(-11); // Nifty, eh ?
            linkManager.sendCommand('FA' + freq + ';FA;');
        },

        onClose: function () {
            console.log("SLevelnumeric view closing...");
            linkManager.off('input', this.showInput, this);
            linkManager.off('status', this.updatestatus, this);
        },

        showInput: function (data) {
            if (data.vfoa) {
                this.$('#vfoa').val(data.vfoa/1e6);
            }
        },
    });
});