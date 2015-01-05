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
 *
 * Send data to Safecast
 *
 * This file manages the settings view for settings that are
 * specific to this output, and that are stored in the output's
 * metadata
 *
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */


define(function(require) {
    
    "use strict";
    
    var _ = require('underscore'),
        Backbone = require('backbone');
        
    var  template = require('tpl/outputs/SafecastSettingsView');
    
    return Backbone.View.extend({
            initialize:function () {
                // Metadata is a simple object looking like this:
                // {  'address': 'name', 'address2': 'name2', etc... }
                this.metadata = this.model.get('metadata');
                if (Object.keys(this.metadata).length == 0) {
                    this.metadata = { 'instance': 'dev' };
                    this.model.set('metadata', this.metadata);
                }
            },

            render:function () {
                $(this.el).html(template({metadata: this.metadata}));
                return this;
            },
    
            events: {
                "change" : "change"
            },
    
            change: function(event) {
                console.log("Safecast output bespoke settings change");

                // Apply the change to the metadata
                var target = event.target;        
                this.metadata[target.name] = target.value;
                this.model.set('metadata',this.metadata);

                // This view is embedded into another view, so change events
                // are going to bubble up to the upper view and change attributes
                // with the same name, so we stop event propagation here. Unless we are
                // changing the numfields attribute which we want to know above above
                event.stopPropagation();

            },
    });
});
