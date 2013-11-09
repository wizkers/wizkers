window.InstrumentListView = Backbone.View.extend({

    initialize: function () {
        
    },

    render: function () {
        var instruments = this.model.models;
        var len = instruments.length;
        console.log("Instrument list: " + len + " instruments");
        var items = parseInt(settings.get('itemsperpage'));
        var startPos = (this.options.page - 1) * items;
        var endPos = Math.min(startPos + items, len);

        $(this.el).html('<div class="row thumbnails"></div>');

        for (var i = startPos; i < endPos; i++) {
            $('.thumbnails', this.el).append(new InstrumentListItemView({model: instruments[i]}).render().el);
        }

        $(this.el).append(new Paginator({model: this.model, page: this.options.page, items: items}).render().el);

        return this;
    }
});

window.InstrumentListItemView = Backbone.View.extend({

    tagName: "div",
    className: "col-md-3",

    initialize: function () {
        this.model.bind("change", this.render, this);
        this.model.bind("destroy", this.close, this);
    },

    render: function () {
        $(this.el).html(this.template(this.model.toJSON()));
        return this;
    },
    
    events: {
        "click .select" : "selectInstrument",
        "click .edit": "editInstrument"
    },
    
    editInstrument: function(event) {
        var url = event.target.href.substr(event.target.baseURI.length);
        app.navigate(url, {trigger: true});
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
            app.navigate('/', true);
        }});
        return false;
    },
    

});