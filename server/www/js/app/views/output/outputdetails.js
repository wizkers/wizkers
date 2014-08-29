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
        tableTemplate = require('tpl/OutputDetailsFieldTable'),
        template = require('tpl/OutputDetailsView');

    return Backbone.View.extend({
        
        id: "output-details",
        
        fields: [],
        
        initialize: function() {
            
            this.fields = this.model.get('datafields');
            
        },

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
                        
            // Now, we want to listen to the instrument to display a nice table of all fields
            // that the instrument outputs, so that the user can select those he wants to send to the
            // output plugin.
            this.wasStreaming = true;
            if (! linkManager.isStreaming() ) {
                linkManager.startLiveStream();
                this.wasStreaming = false;
            }
            this.listenTo(linkManager, 'input', this.showInput);
            
            return this;
        },
        
        onClose: function() {
            if (! this.wasStreaming )
                linkManager.stopLiveStream();
        },

        events: {
            "change"        : "change",
            "click .save"   : "beforeSave",
            "click .delete" : "deleteOutput",
            "click .fieldcheckbox" : "toggleEnabled",
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
        
        toggleEnabled: function(event) {
            var field = event.currentTarget.name;
            var idx = this.fields.indexOf(field);
            if ( idx > -1 ) {
                this.fields.splice(idx);
            } else {
                this.fields.push(field);
            }
            this.model.set('datafields', this.fields);
        },
        
        showInput: function(data) {
            var flat = {};
            if (typeof(data) === "object") {                
                // We sometimes have embedded JSON structures: flatten them
                flat = utils.JSONflatten(data);
                
            } else if (typeof(data) === "string") {
                // If the instrument is sending a string, not much we can do except
                // send that string:
                flat = { "string" : data };
            }
            $(".fieldselect", this.el).html(tableTemplate({fields: flat, selected: this.fields}));

        },

    });
});