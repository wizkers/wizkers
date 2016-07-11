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
 * Extra settings for Elecraft KX3 radios. This is the Wizkers-side part, which
 * (for now) configures the data mode macros.
 */
define(function (require) {
    "use strict";

    var utils = require('app/utils'),
        template = require('js/tpl/instruments/elecraft/ElecraftWizkersSettingsView.js');

    return Backbone.View.extend({

        initialize: function (options) {
            // We are using the "radio_data_macros" key in instrument properties
            if (this.model.get('radio_data_macros') == undefined) {
                this.model.set('radio_data_macros', {
                    cq: 'CQ CQ DE <MYCALL> <MYCALL>',
                    ans: '<YOURCALL> <YOURCALL> DE <MYCALL> pse kn',
                    qso: '<YOURCALL> DE <MYCALL> ',
                    kn: 'btu <YOURCALL> DE <MYCALL> kn',
                    sk: 'Thank you for this QSO, 73 and all the best! <YOURCALL> de <MYCALL> sk',
                    me: 'Operator: John, QTH: Palo Alto, CA. Grid: CM87wk',
                    brag: 'Rig: Elecraft KX3. Controller: Wizkers.io'
                });
            }


        },

        render: function () {
            this.$el.html(template(this.model.toJSON()));
            return this;
        },

        events: {
            "change": "change",
            "click #save-macros": "saveMacros"
        },

        saveMacros: function () {
            console.log("Save macros");
            var self = this;

            this.model.save(null, {
                success: function (model) {
                    utils.showAlert('Success:', 'Configuration saved', 'alert-success');
                },
                error: function () {
                    console.log('Instrument: error saving');
                    utils.showAlert('Error:', 'An error occurred while trying to save intrument config', 'alert-danger');
                }
            });

        },

        change: function (event) {
            console.log("Settings change");

            // Apply the change to the model
            var target = event.target;
            var change = {};

            // Another refinement since I was not able to find another way:
            // sometimes in templates we are coding objects with object.key. The
            // target.name will then by a string called "object.key": catch this
            // and translate it into a proper reference to object.key (and not
            // a new key called "object.key". We only support one level of embedding
            var parts = target.name.split(".");
            if (parts.length > 1) {
                change[parts[0]] = this.model.get(parts[0]);
                if (change[parts[0]] == undefined)
                    change[parts[0]] = {};
                change[parts[0]][parts[1]] = target.value;
            } else {
                change[target.name] = target.value;
            }

            this.model.set(change);

            // This view is embedded into another view, so change events
            // are going to bubble up to the upper view and change attributes
            // with the same name, so we stop event propagation here:
            event.stopPropagation();
        },


    });
});