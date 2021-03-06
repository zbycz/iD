iD.ui.IndoorMode = function (context) {

    var enterButton, indoorControl;

    function createControls(selection) {

        enterButton = selection.append('button')
            .attr('class', 'indoormode-enter-button col12 ')
            .on('click', toggleIndoor)
            .call(buttonTooltip(t('indoor_mode.help'), '⌘⇧I'));
        enterButton
            .append('span').attr('class', 'label').text(t('indoor_mode.title'));


        indoorControl = selection.append('div')
            .attr('class', 'indoormode-control joined');

        indoorControl.append('div') //combo
            .attr('class', 'col4 indoormode-level-combo')
            .append('input')
            .attr('type', 'text')
            .call(d3.combobox().data([].map(comboValues)))
            .on('blur', setLevel)
            .on('change', setLevel);
        spinControl = indoorControl.append('div');
        indoorControl.append('button')
            .attr('class', 'col3')
            .on('click', toggleIndoor)
            .call(buttonTooltip(t('indoor_mode.exit'), '⌘⇧I'))
            .call(iD.svg.Icon('#icon-close'));

        var spinControl;
        spinControl
            .attr('class', 'spin-control col5');
        spinControl.append('button')
            .attr('class', 'increment')
            .on('click', levelChangeFunc(+1))
            .call(buttonTooltip('Level +1'));
        spinControl.append('button')
            .attr('class', 'decrement')
            .on('click', levelChangeFunc(-1))
            .call(buttonTooltip('Level -1'));

        enterButton.classed('hide', true); //.property('disabled', true);
        indoorControl.classed('hide', true);
    }


    return function (selection) {
        createControls(selection);

        var keybinding = d3.keybinding('indoor')
            .on(iD.ui.cmd('⌘⇧I'), toggleIndoor);

        d3.select(document)
            .call(keybinding);

        context
            .on('enter.indoor_mode', update);

        context.indoor()
            .on('levelChanged.indoor_mode', update);

        context.map()
            .on('move.indoor_mode', _.debounce(update, 400))
            .on('drawn.indoor_mode', _.debounce(update, 400));


        function update() {
            var graph = context.graph();
            var showButton = context.indoor().enabled();

            if (!showButton) {
                var selectedEntities = context.selectedIDs().map(function (id) {
                    return graph.entity(id);
                });

                showButton = selectedEntities.some(function isBuilding(e) {
                    return e.tags.building;
                });
            }

            if (!showButton) {
                var displayedEntities = context.intersects(context.map().extent());

                showButton = displayedEntities.some(function hasIndoorRelatedTag(e) {
                    return e.tags.level || e.tags.indoor;
                });
            }

            updateControls(selection, showButton);
        }
    };

    function updateControls(selection, enableButton) {
        if (context.indoor().enabled()) {
            enterButton.classed('hide', true);
            indoorControl.classed('hide', false);
            indoorControl.select('.combobox-input')
                .attr('placeholder', context.indoor().level())
                .value('')
                .call(d3.combobox().data(getLevelsInTags().map(comboValues)));

        }
        else {
            enterButton.classed('hide', !enableButton);
            indoorControl.classed('hide', true);
        }
    }

    function getLevelsInTags() {
        var displayedEntities = context.intersects(context.map().extent());
        var levelsSet = d3.set();
        displayedEntities.forEach(function addToSet(e) {
            if (e.tags.level) {
                var match = e.tags.level.replace(/(-?\d+(\.\d+)?).*/, '$1'); //should parse ranges and so on
                levelsSet.add(match);
            }
        });

        var sorted = levelsSet.values().sort(d3.descending);
        return sorted;
    }

    function toggleIndoor() {
        d3.event.preventDefault();
        context.indoor().toggle();
    }

    function levelChangeFunc(dif) {
        return function () {
            d3.event.preventDefault();
            var current = parseFloat(context.indoor().level());
            var target = current + dif;
            getLevelsInTags().forEach(function findClosestToCurrent(l){
                if ((current < l && l < target) || (target < l && l < current))  {
                    target = dif>0 ? Math.min(target, l) : Math.max(target, l);
                }
            });

            context.indoor().level(target + '');
            indoorControl.select('input').attr('placeholder', context.indoor().level());
        };
    }

    function buttonTooltip(description, cmd) {
        return bootstrap.tooltip()
            .placement('bottom')
            .html(true)
            .title(iD.ui.tooltipHtml(description, (cmd ? iD.ui.cmd(cmd) : undefined)));
    }

    function setLevel() {
        var input = d3.select(this);
        var data = input.value(); //string!
        if (data === '') return; //blank value

        input
            .attr('placeholder', data)
            .value('');

        context.indoor().level(data);
    }

    function comboValues(d) {
        return {
            value: d.toString(),
            title: d.toString()
        };
    }
};
