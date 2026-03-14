# Reading the Weather at Gale Crater

Live Link: `https://visdesignstudies.github.io/module-two-storytelling-remix-wvmillen/`

This project remixes Amber Thomas's Mars weather story from The Pudding into a single-page narrative built with vanilla HTML, CSS, JavaScript, and D3. The new version shifts the focus away from postcard-style Earth/Mars comparison and toward a more cautious argument about variability, seasonality, and measurement limits in Curiosity's local weather record from Gale Crater.

## Original Story Chosen

- Amber Thomas, [Greetings from Mars](https://pudding.cool/2018/01/mars-weather/)
- Public dataset: [The Pudding Mars weather repository](https://github.com/the-pudding/data/tree/master/mars-weather)

## Why I Chose It

I wanted a dataset that felt less overused and more unique but still had a clear enough story structure to remix. The Mars weather project fit that well in my opinion. It has a recognizable setting, a distinctive observational context, and a long run of daily records. It also comes with explicit documentation about caveats, which made it a strong choice for a remix centered on trust and interpretation rather than just chart-making.

## What I Changed in the Remix

The original article leans into the fun of comparing Martian weather with weather on Earth. I shifted the framing toward a narrower question: what can one rover in one crater really tell us?

That led to three changes in emphasis:

1. I made daily temperature spread the opening argument instead of average temperature.
2. I used Ls and pressure to make seasonal structure visible without turning the piece into a standard timeline.
3. I treated the data limitations as part of the story itself, especially the outreach-oriented disclaimer, non-continuous measurement timing, and the missing wind data.

## Visualization Design Decisions

### 1. Daily Extremes in Gale Crater

Question it answers: how large are the day-to-night temperature swings, and how do they change across the mission timeline?

Why this form: the min-max band keeps the low and high temperature visible together, which is better for this story than collapsing the day into a single line. It immediately shows that the spread inside a sol is often the most important part of the weather. I view weather in terms of a highs and lows so i htough when measuring it on mars, it should be the same.

How interactivity helps: this chart is the main controller. Hovering reveals exact values for one sol, selecting a span of sols updates the seasonal chart and highlights the same window in the data-quality chart, and the clear-selection button makes it easy to reset the coordinated view.

### 2. Pressure Through the Martian Year

Question it answers: does the dataset show a seasonal pressure cycle when the same observations are grouped by orbital position instead of mission time?

Why this form: I chose a circular line chart because it visually separates the idea of seasonal recurrence from a regular x-axis timeline. The circular form also makes the chart feel distinct from the first chart, and I think it added a bit of visual intrest and uniqueness as I haven't seen it used elsewhere.

How interactivity helps: the full dataset stays in the background while the current selection from chart 1 appears in the foreground. That linkage lets the reader connect a specific run of sols to where that run sits in the broader Martian year.

### 3. What Curiosity Actually Recorded

Question it answers: which fields are actually present across the mission timeline, and where do the public records become incomplete or unusable?

Why this form: I replaced the scatterplot idea with a field-by-sol availability chart because it supports the argument better. The bigger point of the remix is not just that Gale Crater has daily swings and seasonal structure, but that those patterns are shaped by what was and was not recorded.

How interactivity helps: hovering the chart highlights the corresponding sol back in the first chart, and the selected range from chart 1 carries into this view so readers can compare a focused period with the larger mission record.

## View Coordination

View coordination was the main extra-credit target, so I built the page around shared application state:

- selecting a span in the first chart updates the seasonal chart and the data-quality chart
- hovering the data-quality chart highlights the matching sol in the first chart
- the linked views let the reader move from a local weather window to both seasonal context and recording context

The goal was to make each chart answer a different part of the same question while keeping the reader oriented as they move between local daily patterns, seasonal structure, and recording context.


## Limitations and Tradeoffs

The biggest limitation is scope. This is Curiosity in Gale Crater, not all of Mars.

The dataset README also quotes a disclaimer from the original source saying the file is intended for outreach use and should be handled cautiously outside that context. It notes rover influence, non-continuous measurement timing, operational issues, and missing values. I surfaced those points directly on the page because hiding them would weaken the project's credibility.

The `wind_speed` field is especially limited. The metadata says wind speed stopped being transmitted after sol 1485 and that missing values are coded as `NaN`, but in the published CSV used here the field is effectively unavailable throughout. That is why I kept wind out of the main visual argument.

## AI Use Disclosure

AI was used for finding data stories and sources, and helping style the webpage on github pages.

## Sources

- Amber Thomas, [Greetings from Mars](https://pudding.cool/2018/01/mars-weather/)
- The Pudding, [Mars weather dataset and README](https://github.com/the-pudding/data/tree/master/mars-weather)
- NASA, [Curiosity mission overview](https://science.nasa.gov/mission/msl-curiosity/)
- NASA, [A Martian Day](https://science.nasa.gov/resource/a-martian-day/)
- NASA/JPL, [REMS instrument overview](https://mars.nasa.gov/msl/mission/instruments/environsensors/rems/)

## Running Locally

Because this is a static site, any simple local server works. Just run this commadn and you shoudl be good:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000/`.
