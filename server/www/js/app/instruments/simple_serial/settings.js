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

/**
 *  Settings returns an intrument settings view. These are displayed
 * on top of standard instrument settings in the instrument details view.
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */


define(function (require) {
    "use strict";

    var $ = require('jquery'),
        _ = require('underscore'),
        Backbone = require('backbone'),
        template = require('js/tpl/instruments/SimpleSerialSettingsView.js');

    return Backbone.View.extend({
        initialize: function () {
            // Metadata is a simple object looking like this:
            // {  'baudrate': 115200 }
            this.portsettings = this.model.get('metadata');
            if (this.portsettings == null) {
                this.portsettings = {
                    baudrate: 115200,
                    lines: 600
                };
                this.model.set('metadata', this.portsettings);
            }
            this.render();
        },

        render: function () {
            $(this.el).html(template({
                portsettings: this.portsettings
            }));
            return this;
        },

        events: {
            "change": "change"
        },

        change: function (event) {
            console.log("Simple Serial bespoke settings change");

            // Apply the change to the metadata
            var target = event.target;
            this.portsettings[target.name] = target.value;
            this.model.set('metadata', this.portsettings);

            // This view is embedded into another view, so change events
            // are going to bubble up to the upper view and change attributes
            // with the same name, so we stop event propagation here:
            event.stopPropagation();

        },
    });
});