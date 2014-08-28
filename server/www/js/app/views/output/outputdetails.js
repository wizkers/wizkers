/**
 * Displays an editable view of an output's details.
 * We support output-specific metadata and ad-hoc view if the output
 * plugin defines it.
 *
 * (c) 2014 Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 */

define(function(require) {
    
    "use strict";
    
    var $       = require('jquery'),
        _       = require('underscore'),
        Backbone = require('backbone'),
        utils   = require('app/utils'),
        template = require('js/tpl/OutputDetailsView.js');

    return Backbone.View.extend({
        
        id: "output-details",

        render: function () {
            console.log("Render output details");
            
            $(this.el).html(template(_.extend(this.model.toJSON(), {outtypes: outputManager.getOutputsForCurrentInstrument()})));

            // If the instrument type has got its own extra settings, then render those here:
            var outSettingsView = outputManager.supportedOutputs[this.model.get('type')].settings;
            if ( outSettingsView != null) {
                var settingsView = new outSettingsView({model: this.model});
                $('#metadata',this.el).html(settingsView.el);
                settingsView.render();
            }
            
            return this;
        },

        events: {
            "change"        : "change",
            "click .save"   : "beforeSave",
            "click .delete" : "deleteOutput",
        },

        change: function (event) {
            console.log("Output settings change");
            // Remove any existing alert message
            utils.hideAlert();

            // Apply the change to the model
            var target = event.target;
            var change = {};

            // Our Spinedit control returns values as strings even
            // when they are numbers (uses .val() in the setvalue method),
            // so we have to attempt to convert it back to a number if it makes
            // sense:
            var numval = parseFloat(target.value);
            change[target.name] = isNaN(numval) ? target.value : numval;
            this.model.set(change);

            // Run validation rule (if any) on changed item
            var check = this.model.validateItem(target.id);
            if (check.isValid === false) {
                utils.addValidationError(target.id, check.message);
            } else {
                utils.removeValidationError(target.id);
            }

            // TODO: is this right ?
            // This view is embedded into another view, so change events
            // are going to bubble up to the upper view and change attributes
            // with the same name, so we stop event propagation here:
            event.stopPropagation();
        },

        beforeSave: function () {
            var self = this;
            console.log('Output: before save for output ' + this.model.id);
            var check = this.model.validateAll();
            if (check.isValid === false) {
                utils.displayValidationErrors(check.messages);
                return false;
            }

            this.saveOutput();
            return false;
        },

        saveOutput: function () {
            var self = this;

            this.model.save(null, {
                success: function (model) {
                    utils.showAlert('Success', 'Configuration saved', 'alert-success');
                },
                error: function () {
                    console.log('Output: error saving');
                    utils.showAlert('Error', 'An error occurred while trying to save output config', 'alert-error');
                }
            });
        },

        deleteOutput: function () {
            self = this;
            console.log("Delete output " + this.model.id);
            this.model.destroy({
                success: function () {
                    //alert('Controller deleted successfully');
                    self.remove();
                    //this.render();
                    return false;
                }
            });
            return false;
        },

    });
});