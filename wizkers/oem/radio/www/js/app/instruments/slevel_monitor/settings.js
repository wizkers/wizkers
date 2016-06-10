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

/**
 * Extra settings for the Signal Monitor instrument.
 */
define(function (require) {
    "use strict";

    var $ = require('jquery'),
        _ = require('underscore'),
        Backbone = require('backbone'),
        template = require('js/tpl/instruments/slevel_monitor/SettingsView.js');

    return Backbone.View.extend({

        initialize: function (options) {
            if (this.model.get('radio_type') == undefined) {
                this.model.set('radio_type','elecraft');
            }
        },

        render: function () {
            this.$el.html(template(_.extend(this.model.toJSON(), {
                radios: instrumentManager.supportedInstruments
            })));
            return this;
        }

    });
});