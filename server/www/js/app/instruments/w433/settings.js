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


define(function(require) {
    "use strict";
    
    var $       = require('jquery'),
        _       = require('underscore'),
        Backbone = require('backbone'),
        template = require('js/tpl/instruments/W433SettingsView.js');
    
    return Backbone.View.extend({
            initialize:function () {
                // Metadata is a simple object looking like this:
                // {  'address': 'name', 'address2': 'name2', etc... }
                this.mappings = this.model.get('metadata');
                if (this.mappings == null) {
                    this.mappings = {};
                    this.model.set('metadata', this.mappings);
                }
                this.render();
            },

            render:function () {
                $(this.el).html(template({mappings: this.mappings}));
                return this;
            },
    
            events: {
                "change" : "change"
            },
    
            change: function(event) {
                console.log("W433 bespoke settings change");

                // Apply the change to the metadata
                var target = event.target;        
                this.mappings[target.name] = target.value;
                this.model.set('metadata',this.mappings);

                // This view is embedded into another view, so change events
                // are going to bubble up to the upper view and change attributes
                // with the same name, so we stop event propagation here:
                event.stopPropagation();

            },
    });
});
