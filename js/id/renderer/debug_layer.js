iD.DebugLayer = function(context) {
    function background(selection) {
        var projection = context.projection;

        var svg = selection.selectAll('svg')
            .data([0]);

        svg.enter().append('svg');

        var nodes = svg.selectAll('.quadtree-node')
            .data(context.plane().nodes(context.extent()), function(d) { return [d.x, d.y, d.z]; });

        var enter = nodes.enter().append('g')
            .attr('class', 'quadtree-node');

        nodes.attr('transform', function(d) {
            var e = d.extent(),
                tl = projection([e[0][0], e[1][1]]);
            return 'translate(' + tl[0] + ',' + tl[1] + ')';
        });

        function size(d) {
            var e = d.extent();
            return projection(e[1])[0] - projection(e[0])[0];
        }

        enter.append('rect')
            .attr('x', 0)
            .attr('y', 0)
            .style('stroke-width', 1)
            .style('stroke', 'white')
            .style('fill', 'none');

        nodes.selectAll('rect')
            .attr('width', size)
            .attr('height', size);

        enter.append('text')
            .attr('text-anchor', 'middle')
            .style('fill', 'white')
            .text(function(d) {
                return d.z + '/' + d.x + '/' + d.y;
            });

        enter.append('text')
            .attr('class', 'status')
            .attr('dy', '1em')
            .attr('text-anchor', 'middle')
            .style('fill', 'white');

        nodes.selectAll('text')
            .attr('x', function(d) { return size(d) / 2; })
            .attr('y', function(d) { return size(d) / 2; });

        nodes.selectAll('.status')
            .text(function(d) { return d.status; });

        nodes.exit()
            .remove();
    }

    return background;
};
