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
 * Display output of power logger in numeric format
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */

define(function (require) {
    "use strict";

    var $ = require('jquery'),
        _ = require('underscore'),
        Backbone = require('backbone'),
        utils = require('app/utils'),
        template = require('js/tpl/instruments/powerlog_1/NumView.js');


    return Backbone.View.extend({

        initialize: function (options) {
            this.sessionStartStamp = new Date().getTime();
            this.maxreading = 0;
            this.minreading = -1;
            linkManager.on('input', this.showInput, this);
        },

        events: {},

        render: function () {
            var self = this;
            console.log('Main render of Powerlog numeric view');
            this.$el.html(template());
            return this;
        },

        onClose: function () {
            console.log("Powerlog numeric view closing...");
            linkManager.off('input', this.showInput, this);
        },

        showInput: function (data) {

            // We don't want to do anything on replays, it just
            // eats CPU cycles.
            if (data.replay_ts != undefined)
                return;

            if (typeof (data.power) == 'undefined')
                return;
            var pwr = parseFloat(data.power);
            $('#livepower', this.el).html(pwr.toFixed(0));

            // Update statistics:
            var sessionDuration = (new Date().getTime() - this.sessionStartStamp) / 1000;
            $('#sessionlength', this.el).html(utils.hms(sessionDuration));

            if (pwr > this.maxreading) {
                this.maxreading = pwr;
                $('#maxreading', this.el).html(pwr);
            }
            if (pwr < this.minreading || this.minreading == -1) {
                this.minreading = pwr;
                $('#minreading', this.el).html(pwr);
            }

        },


    });
});