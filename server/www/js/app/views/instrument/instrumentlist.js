/**
 * Defines a list of instruments, arranged as a series of 'cards'
 *
 * (c) 2014 Edouard Lafargue, ed@lafargue.name
 */

define(function(require) {
    
    "use strict";
    
    var $       = require('jquery'),
        _       = require('underscore'),
        Backbone = require('backbone'),
        Paginator = require('app/views/paginator'),
        tpl     = require('text!tpl/InstrumentListItemView.html'),
        
        template = _.template(tpl),
    
        InstrumentListItemView = Backbone.View.extend({

            tagName: "div",
            className: "col-md-3 col-sm-2",

            initialize: function () {
                this.model.bind("change", this.render, this);
                this.model.bind("destroy", this.close, this);
            },

            render: function () {
                $(this.el).html(template(this.model.toJSON()));
                return this;
            },

            events: {
                "click .select" : "selectInstrument",
                "click .edit": "editInstrument"
            },

            editInstrument: function(event) {
                var url = event.target.href.substr(event.target.baseURI.length);
                router.navigate(url, {trigger: true});
                event.stopPropagation();
            },

            selectInstrument: function(event) {
                console.log('Instrument selected: ' + this.model.id);
                var theID = this.model.id;
                // Now store the instrument ID in our settings:
                settings.set({currentInstrument:theID});
                // Update our settings to use the correct port: 
                settings.set({ serialPort: this.model.get('port')});
                settings.save(null, {success: function() {
                    // We have to close the current instrument before getting to the main page:
                    try {
                        var id = instrumentManager.getInstrument().id;
                        linkManager.closeInstrument(id);
                    } catch (err) {
                        console.log("No current instrument selected, not closing it");
                    }
                    // Disabled the navigate below: our router will trigger this once hte
                    // new instrument is loaded, so that we don't get a double rendering, which is
                    // super expensive (once of the old instrument, once of the new instrument)
                    //router.navigate('/', true);
                    return false;
                }});
                return false;
            },
        });

    return Backbone.View.extend({

        initialize: function (options) {
            this.options = options || {};
        },

        render: function () {
            var instruments = this.model.models;
            var len = instruments.length;
            console.log("Instrument list: " + len + " instruments");
            var items = parseInt(settings.get('itemsperpage'));
            var startPos = (this.options.page - 1) * items;
            var endPos = Math.min(startPos + items, len);

            $(this.el).html('<div class="col-md-12"><div class="row thumbnails"></div></div>');

            for (var i = startPos; i < endPos; i++) {
                $('.thumbnails', this.el).append(new InstrumentListItemView({model: instruments[i]}).render().el);
            }

            $(this.el).append(new Paginator({model: this.model, page: this.options.page, items: items}).render().el);

            return this;
        }
    });

});