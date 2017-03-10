# Lambdon is you AWS Lambda debugging companion

This tool is focused on `AWS`'s `Lambda` functions debugging including integrations with `AWS`'s `Api Gateway`.

# Main Features

- Almost realtime logs display
- Quite friendly, interactive UX/UI 
- Automatically handles lambda integrations (with `Api Gateway`)
- Automatically handles throttling thru concurrency and retries
- Configurable and pretty straight forward

# Requirements

- `node >= 6.0`

> In order to debug `Api Gateway` integrations you must have 
> `Enable CloudWatch Logs` option enabled for each api stage

# Installation

- `npm install lambdon -g`

# Usage

```
Usage: lambdon -m "hello" --integrations [options]

Options:
  --profile, -p           AWS Profile to use
  --region, -r            AWS Region to use               [default: "us-east-1"]
  --match, -m             AWS Lambda functions match string
  --integrations          Include AWS Lambda > ApiGateway integrations [boolean]
  --log-group, -g         Specify explicit the AWS CloudWatchLogs group to
                          listen to                             [default: false]
  --concurrency           AWS api calls concurrency                 [default: 5]
  --top-n, -n             Top N CloudWatchLogs streams to listen by
                          lastEventTimestamp                     [default: 9999]
  --timeout, -t           Empty logs timeout before the program ends[default: 0]
  --pooling-interval, -i  CloudWatchLogs streams pooling interval  [default: 50]
  --retry-timeout         Retry timeout for throttled AWS api calls
                                                                  [default: 200]
  --raw                   Enable raw output                     [default: false]
  --version, -v           Program version                              [boolean]
  -h, --help              Show help                                    [boolean]

```

# Gotchas

Due to distributed nature of AWS services the logs may arrive with a delay
and be a bit shuffled. Pay attention at log time displayed ;)

# ToDo

- Add retry strategies
- Handle multiple Lambda functions at once
- Add output formatters
- Add tests
- Improve overall code quality

> P.S. Pull Requests are welcome!
