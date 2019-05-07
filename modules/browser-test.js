const express = require('express');
const app = express();
const argv = require('minimist')(process.argv.slice(2));
const runTest = require('./run-test.js');
const testFolder = './tests/';
const fs = require('fs');



app.set('views', __dirname + '/');
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');
// app.use(express.static('public'));

var bodyParser = require('body-parser')
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

app.get('/', (req,res) => {
    fs.readdir(testFolder, (err, sampleTests) => {
        res.render('../public/form.ejs', {sampleTests});
      });
});

app.post('/chart', (req, res) => {
    const query = req.body;
    let testOptions = {
        title: query.title,
        jsonTest: query.test,
        tests: new Array,
        runs: query.runs || argv['runs'] || 10,
        verbose: Boolean(query.verbose) || argv['v'] || argv['verbose'],
        gzip: Boolean(query.gzip) || argv['gzip'] || argv['compression'],
        http2: Boolean(query.http2) || argv['http2'],
        benchmark: false,
        location: query.location || argv['location'],
        image: Boolean(query.image),
        table: Boolean(query.table)
    };
    if (testOptions.verbose) console.log('Form data', req.body);

    for (let index = 0; index < query.feeds.length; index++) {
        const feed = query.feeds[index];
        if ( feed[0] && feed[1] ) {
            testOptions.tests.push({
                label: feed[0],
                url: feed[1]
            });
        } else if ( ! feed[0] && feed[1] ) {
            testOptions.tests.push({
                label: feed[1],
                url: feed[1]
            });
        }  
    }
    if (testOptions.tests.length > 1 ) testOptions.benchmark = true;

    if (testOptions.verbose) console.log(testOptions);

    runTest(testOptions)
        .then( testResults => createChart(testOptions, testResults))
        .then( chart => {
            res.render('../public/chart.ejs', {chartData: chart.data, chartOptions: chart.options, pageOptions: chart.pageOptions} );
            console.log('Chart complete!');
        });

});


const port = 4000;
app.listen(port, () => console.log(`Generate chart at http://localhost:${port} and replace localhost with a server IP`));

function createChart(testOptions, testResults) {
    if (testOptions.verbose) console.log(testResults);

    let testKb = Math.round(testResults.sourceBytes / 1024 * 10) / 10;
    let subtitle = `Source: ${testKb} KB uncompressed`;

    if (testOptions.gzip) {
        let testKbGzip = Math.round(testResults.sourceBytesGzip / 1024 * 10) / 10;
        subtitle +=  ` / ${testKbGzip} KB Gzip`;
    }

    chartColumns = [
        'Feed host',
        'Avg.',
        'Median',
    ];
    if (testOptions.benchmark) chartColumns.push('× Median Benchmark')
    
    if (testOptions.gzip) {
        chartColumns.push(
            'Gzip Avg.',
            'Gzip Median',
        );
        if (testOptions.benchmark) chartColumns.push('× Gzip Median Benchmark')
    }

    if (testOptions.runs > 1) {
        runsLabel = 'runs';
    } else {
        runsLabel = 'run';
    }

    let chartRows = new Array;

    for (const result of testResults.results) {
        // console.log(result.label);
        let pushToChart = [
            result.label,
            result.average,
            result.median,
        ];
        if (testOptions.benchmark) pushToChart.push(result.benchmarkMedian);
        
        if (testOptions.gzip) {
            pushToChart.push(
                result.averageGzip,
                result.medianGzip,
            );
            if (testOptions.benchmark) pushToChart.push(result.benchmarkMedianGzip);
        }

        chartRows.push(pushToChart);
    }

    
    let chart = new Object;
    
    chart.pageOptions = {
        // title: testOptions.title + ' feed performance',
        // subtitle: '',
        image: testOptions.image,
        table: testOptions.table,
        ...testOptions
    }
    
    chart.data = [
        chartColumns,
        ...chartRows,
    ];
    if (testOptions.verbose) console.log(chart.data);
    
    chart.options = {
        width: '100%',
        height: 600,
        title: `${testOptions.title} feed performance (${testOptions.runs} ${runsLabel})`,
        titleTextStyle: {
            fontSize: 24,
            bold: false,
        },
        chartArea: {
            width: '85%',
            height: '75%',
            // left:10,
            // top:100,
        },
        colors: [
            'rgb(50,100,150)',
            'rgb(75,125,175)',
            'rgb(200,75,0)',
            'rgb(225,100,25)',
        ],
        seriesType: 'bars',
        vAxis: {
            title: 'Loading time (ms)',
        },
        hAxis: {
            title: subtitle,
        },
        legend: {
            maxLines: 2,
            position: 'top',
            alignment: 'center',
        },
        vAxes: {
            0: {
                baseline: 0,
            },
        }
    }

    if (testOptions.benchmark) {
        chart.options.colors = [
            'rgb(50,100,150)',
            'rgb(75,125,175)',
            'rgb(100,150,200)',
            'rgb(200,75,0)',
            'rgb(225,100,25)',
            'rgb(250,125,50)',
        ];
        chart.options.series = {
            2: {
                type: 'line',
                targetAxisIndex: 1,
                lineWidth: 4,
            },
            5: {
                type: 'line',
                targetAxisIndex: 1,
                lineWidth: 4,
            }
        }
        chart.options.vAxes[1] = {
            title: '× Benchmark',
            baseline: 0,
            gridlines: { count: 0 },
            format: '##.##×'
        }
    }
    return new Promise( (resolve, reject) => {
        resolve(chart);
    });
    
}   
