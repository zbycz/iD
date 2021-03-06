iD.Indoor = function (context) {
    var dispatch = d3.dispatch('levelChanged'),
        indoorMode = false,
        indoorLevel = '0',
        enabledFeaturesBeforeIndoor,
        features = context.features();


    function indoor() {}

    indoor.enabled = function () {
        return indoorMode;
    };

    indoor.level = function (newLevel) {
        if (newLevel) { // setter
            indoorLevel = newLevel;
            if (indoorMode)
                redraw();
            else
                indoor.toggle();
        }
        return indoorLevel;
    };

    indoor.toggle = function () {
        if (!context.surface()) { // hash calls before surface is initialized
            setTimeout(indoor.toggle, 200);
            return false;
        }

        if (indoorMode)
            disable();
        else
            enable();
    };

    function enable() {
        indoorMode = true;

        var selectedFeatures = context.selectedIDs();
        if (selectedFeatures.length) {
            var entity = context.graph().entity(selectedFeatures[0]);
            if (entity.tags.level)
                indoorLevel = entity.tags.level.replace(/(-?\d+(\.\d+)?).*/, '$1');
        }

        enabledFeaturesBeforeIndoor = features.enabled();
        _.each(features.keys(), features.disable);
        _.each(['indoor', 'buildings', 'points', 'paths', 'traffic_roads', 'service_roads'], features.enable);

        redraw();

        if (selectedFeatures.length) {
            context.enter(iD.modes.Select(context, selectedFeatures));
        }
    }

    function disable() {
        indoorMode = false;

        _.each(_.difference(features.keys(), enabledFeaturesBeforeIndoor), features.disable);
        _.each(enabledFeaturesBeforeIndoor, features.enable);

        indoorLevel = '0';
        redraw();
        setBackgroundOpacity('revert');
    }

    function redraw() {
        context.surface().classed('indoor-mode', indoorMode);
        context.surface().classed('indoor-underground', indoorLevel < 0);
        setBackgroundOpacity(indoorLevel < 0 ? 0.05 : 0.2);

        features.reset();
        dispatch.levelChanged(); // update hash & combo, redraw map
    }

    function setBackgroundOpacity(d) {
        var bg = context.container().selectAll('.layer-background');
        if (d === 'revert')
            d = bg.attr('data-opacity');
        bg.transition().style('opacity', d);
        if (!iD.detect().opera) {
            iD.util.setTransform(bg, 0, 0);
        }
    }


    // ---- tagging related -----

    var rangeRegExp = /^(-?\d+(?:\.\d+)?)(?:(-)(-?\d+(?:\.\d+)?)|(;-?\d(?:\.\d+)?)+)?$/;
    indoor.inRange = function (level, entity) {
        return textInRange(level, entity.tags.level) || textInRange(level, entity.tags.repeat_on, true);
    };

    function textInRange(level, rangeText, discreetValuesRange) {
        var range = rangeText && rangeRegExp.exec(rangeText);

        if (!range) {  //blank text OR not matched
            return false;
        }

        if (range[2] === undefined && range[4] === undefined) { //exact match
            if (range[1] === level) {
                return true;
            }
        }
        else if (range[2] === '-') { // range from - to, only numeric comparison
            var min = parseFloat(range[1]);
            var max = parseFloat(range[3]);
            if (min <= level && max >= level) {
                return discreetValuesRange ? isDecimalPartEqual(level, min) : true;
            }
        }
        else { // range list
            if (range[0].split(';').indexOf(level) !== -1) {
                return true;
            }
        }
        return false;
    }

    function isDecimalPartEqual(a, b) {
        return Math.abs(a % 1 - b % 1) < 0.0001; //decimal part equals
    }

    return d3.rebind(indoor, dispatch, 'on');
};
