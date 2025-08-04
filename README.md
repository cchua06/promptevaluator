# Custom GPT Prompt Evaluator

by: Cedric Chua (cedric.chua@thinkingmachin.es)

## Description

A web app that can be used to provide custom feedback to evaluate user prompts to a LLM. The frontend is build on React, and the backend uses NodeJS. The service is being hosted as a POC on Render (https://promptevaluator-umx3.onrender.com/). It has a participant view and an admin view to see collated user prompts.

## Usage

Create a .env file in your clone repository. It should contain the following fields:

```
OPENAI_API_KEY=
PGHOST=
PGUSER=
PGPASSWORD=
PGDATABASE=
PGPORT=
```

Run:

```
npm install
node server.js
```