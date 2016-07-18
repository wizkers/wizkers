/**
 * This file is part of Wizkers.io
 *
 * The MIT License (MIT)
 *  Copyright (c) 2016 Edouard Lafargue, ed@wizkers.io
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the Software
 * is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR
 * IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

/**
 * Displays an editable view of an output's details.
 * We support output-specific metadata and ad-hoc view if the output
 * plugin defines it.
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */

define(function(require) {

    "use strict";

    var $       = require('jquery'),
        _       = require('underscore'),
        Backbone = require('backbone'),
        utils   = require('app/utils'),
        tableTemplate = require('tpl/OutputDetailsFieldTable'),
        outputMappingsTemplate = require('tpl/OutputDetailsMappingTable'),
        template = require('tpl/OutputDetailsView');

    return Backbone.View.extend({

        id: "output-details",
        gotdata: false,

        initialize: function() {

            // Mapping is "outputfield" : "datafield"
            this.devicefields = this.model.get('mappings');

            // We need to query our output plugin for the fields it needs, so that we can map them.
            //
            // Some plugins can accept a variable number of fiels, named "Field1" ... "FieldN", and
            // this.outputfields will be "variable" in that case.
            this.generateOutputFields();

        },

        generateOutputFields: function() {
            this.outputfields = outputManager.getOutputFields(this.model.get('type'));
            if (this.outputfields == "variable") {
                var num = parseInt(this.model.get('metadata')['numfields']) || 1;
                this.outputfields = {};
                for (var i=1; i < num+1 ; i++) {
                    this.outputfields['field' + i] = { "name": "Field " + i,
                                                      "required": (i==1)? true: false
                                                     };
                }
            } else if (this.outputfields == 'none') {
                this.outputfields = {};
            }
        },

        render: function () {

            console.log("Render output details");

            this.$el.html(template(_.extend(this.model.toJSON(), {outtypes: outputManager.getOutputsForCurrentInstrument(),
                                                                   outputfields: this.outputfields
                                                                   })));

            // If the output type has got its own extra settings, then render those here:
            var outSettingsView = outputManager.supportedOutputs[this.model.get('type')].settings;
            if ( outSettingsView != null) {
                var settingsView = new outSettingsView({model: this.model});
                $('#metadata',this.el).html(settingsView.el);
                settingsView.render();
            }

            // Some outputs want all the data: in that case, override the "When to Send it" tab
            if ( outputManager.pluginWantsAllData(this.model.get('type')) ) {
                $("#what").html("<p>This plugin requests access to all data sent by the instrument, so there is nothing to setup here.</p>");
                $("#when").html("<p>This plugin requests access to all data sent by the instrument, so there is nothing to setup here.</p>");
                this.model.set('wantsalldata', true);
            }

            this.renderMappingsTable();

            // Now, we want to listen to the instrument to display a nice table of all fields
            // that the instrument outputs, so that the user can select those he wants to send to the
            // output plugin.

            this.wasStreaming = linkManager.isStreaming();
            linkManager.startLiveStream();
            this.listenTo(linkManager, 'input', this.showInput);

            return this;
        },

        renderMappingsTable: function() {
            var self = this;
            // Populate the field mappings: we are going to enrich the output plugin
            // config with the name of the data field it is mapped to

            // Gotta refresh the default outputfields each time
            this.generateOutputFields();
            if (Object.keys(this.outputfields).length) {
                _.each(this.outputfields, function(field, fieldname) {
                    var mapped = self.devicefields[fieldname];
                    if (mapped != undefined)
                        self.outputfields[fieldname].mappedto = mapped;
                });

                $("#mappings", this.el).html(outputMappingsTemplate({mappings: this.outputfields}));
            } else {
                $("#mappings", this.el).html('<p>This plugin does not support output fields, it formats its output data by itself.</p>');
            }


        },

        onClose: function() {
            if (! this.wasStreaming )
                linkManager.stopLiveStream();
        },

        events: {
            "change"        : "change",
            "click .save"   : "beforeSave",
            "click .delete" : "deleteOutput",
            "click #do-delete": "doDeleteOutput",
            "click .fieldcheckbox" : "toggleEnabled",
        },

        change: function (event) {
            console.log("Output settings change");
            // Remove any existing alert message
            utils.hideAlert();

            // Apply the change to the model
            var target = event.target;
            var change = {};

            // A change for a field mapping is a bit more complex and needs
            // to be handled separately
            if (target.name == "fieldmapping") {
                var devicefield = $(event.target).data("field");
                if (target.value == "_unused") {
                  // We removed a mapping: we need to go through all device fields
                  // and look where this field was used, to remove it
                  for (var fieldname in this.devicefields) {
                      if (this.devicefields[fieldname] == devicefield)
                          delete this.devicefields[fieldname];
                    };
                } else {
                    this.devicefields[target.value] = devicefield;
                }
                this.model.set('mappings', this.devicefields);
                this.renderMappingsTable();
            } else if (target.name == "staticvalue") {
                var field = $(target).data('field');
                if (target.value == '') {
                    delete this.devicefields[field];
                } else {
                    this.devicefields[field] = "__" + target.value;
                }
                this.model.set('mappings', this.devicefields);
                this.renderMappingsTable();
            }  else if (target.name.indexOf("alarm") == 0) {
                // Update our alarms:
                var keys = target.name.split(".");
                var alrm = this.model.get(keys[0]);
                alrm[keys[1]] = target.value;
                this.model.set(keys[0],alrm);
            } else if (target.name == 'numfields') {
                // this is a change that bubbled up from the bespoke settings view,
                // we just need to re-render for the updated number of fields
                this.gotdata = false;
                this.generateOutputFields();
                this.render();
                // And switch back to the correct tab so that the user is not surprised:
                $('#settingsTabs a[href="#props"]').tab('show')

            } else {

                // Our Spinedit control returns values as strings even
                // when they are numbers (uses .val() in the setvalue method),
                // so we have to attempt to convert it back to a number if it makes
                // sense:
                var numval = parseFloat(target.value);
                change[target.name] = isNaN(numval) ? target.value : numval;
                this.model.set(change);

                // If we changed the plugin type, we need to reset the view:
                if (target.name == "type") {
                    this.gotdata = false;
                    // Clear the medatadata
                    this.model.set('metadata', {});
                    this.generateOutputFields();
                    this.render();
                }

            }

            // TODO: is this right ?
            // This view is embedded into another view, so change events
            // are going to bubble up to the upper view and change attributes
            // with the same name, so we stop event propagation here:
            event.stopPropagation();
        },

        beforeSave: function () {
            console.log('Output: before save for output ' + this.model.id);

            this.saveOutput();
            return false;
        },

        saveOutput: function () {
            var self = this;
            this.model.save(null, {
                success: function (model) {
                    utils.showAlert('Success', 'Configuration saved', 'alert-success');
                    linkManager.setOutputs(instrumentManager.getInstrument().id);
                },
                error: function () {
                    console.log('Output: error saving');
                    utils.showAlert('Error', 'An error occurred while trying to save output config', 'alert-error');
                }
            });
        },

        deleteOutput: function() {
            if (this.model.id == undefined) {
                console.log("User wants to delete an output that was not created yet");
                router.navigate('outputs', {trigger: true});
                return;
            }

            $('#deleteConfirm',self.el).modal('show');
        },

        doDeleteOutput: function () {
            self = this;
            console.log("Delete output " + this.model.id);
            this.model.destroy({
                success: function () {
                    $('#deleteConfirm',self.el).modal('hide');
                    router.navigate('outputs', {trigger: true});
                }
            });
            return false;
        },

        toggleEnabled: function(event) {
            var field = event.currentTarget.name;
            var idx = this.devicefields.indexOf(field);
            if ( idx > -1 ) {
                this.devicefields.splice(idx);
            } else {
                this.devicefields.push(field);
            }
            this.model.set('datafields', this.devicefields);
        },

        showInput: function(data) {
            if (this.gotdata)
                return;
            var flat = {};
            if (typeof(data) === "object") {
                // We sometimes have embedded JSON structures: flatten them
                flat = utils.JSONflatten(data);
                this.gotdata = true;
            } else if (typeof(data) === "string") {
                // If the instrument is sending a string, not much we can do except
                // send that string:
                flat = { "string" : data };
                this.gotdata = true;
            }
            this.$(".fieldselect").html(tableTemplate({fields: flat, outputfields: this.outputfields, selected: this.devicefields}));
            // Make sure that fieldselect is bound vertically by window height, so that
            // the scrollbars appear
            if (vizapp.type == 'chrome') {
                var tbheight = window.innerHeight - this.$('#title1').height() - this.$('#topoutputinfo').height() - this.$('#outputtabsarea').height() - $('.header .container').height() - 20;
                this.$('#tablewrapper').css('max-height',
                    tbheight + 'px'
                );
            }
        },

    });
});