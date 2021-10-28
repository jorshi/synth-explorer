

## Heroku
See [heroku django](https://devcenter.heroku.com/articles/getting-started-with-python) tutorial.

Some useful commands once setup:

To get heroku app info: `heroku info`

Run locally:
`heroku local`

### Databases
Heroku uses postgres. To run a postgres database locally:
- Setup [postgres](https://devcenter.heroku.com/articles/heroku-postgresql#local-setup)
- Create a database 
- (Optional) instead of setting `DATABASE_URL` env variable can update the settings.py
file to use postgres. Create a postgres db called `synth_browse`.
    - Create `createdb synth_browse`
    - (if you need to reset) `dropdb synth_browse`
    
- Migrate: `python manage.py migrate`

Deploying a local database to production:
- Uses the command [pg:push](https://devcenter.heroku.com/articles/heroku-postgresql#pg-push)
- `heroku pg:push synth_browse DATEBASE_URL --app appname`

### Deploying
```
git push heroku main
```