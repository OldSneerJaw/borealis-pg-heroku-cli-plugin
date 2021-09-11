import {Command, flags} from '@heroku-cli/command'
import {HTTP, HTTPError} from 'http-call'
import color from '@heroku-cli/color'
import cli from 'cli-ux'
import {getBorealisPgApiUrl, getBorealisPgAuthHeader} from '../../../borealis-api'
import {createHerokuAuth, removeHerokuAuth} from '../../../heroku-auth'

const pgExtensionColour = color.green

export default class RemovePgExtensionCommand extends Command {
  static description = 'removes a Postgres extension from a Borealis Isolated Postgres add-on'

  static args = [
    {name: 'PG_EXTENSION', description: 'name of a Postgres extension', required: true},
  ]

  static flags = {
    addon: flags.string({
      char: 'o',
      description: 'name or ID of a Borealis Isolated Postgres add-on',
      required: true,
    }),
    confirm: flags.string({
      char: 'c',
      description: 'bypass the prompt for confirmation by specifying the name of the extension',
    }),
  }

  async run() {
    const {args, flags} = this.parse(RemovePgExtensionCommand)
    const addonName = flags.addon
    const pgExtension = args.PG_EXTENSION

    let confirmation: string
    if (flags.confirm) {
      confirmation = flags.confirm
    } else {
      confirmation = await cli.prompt('Enter the name of the extension to confirm its removal')
    }

    if (confirmation.trim() !== pgExtension) {
      this.error(`Invalid confirmation provided. Expected ${pgExtensionColour(pgExtension)}.`)
    }

    const authorization = await createHerokuAuth(this.heroku)

    try {
      cli.action.start(
        `Removing Postgres extension ${pgExtensionColour(pgExtension)} from add-on ${color.addon(addonName)}`)

      await HTTP.delete(
        getBorealisPgApiUrl(`/heroku/resources/${addonName}/pg-extensions/${pgExtension}`),
        {headers: {Authorization: getBorealisPgAuthHeader(authorization)}})

      cli.action.stop()
    } finally {
      await removeHerokuAuth(this.heroku, authorization.id as string)
    }
  }

  async catch(err: any) {
    const {args, flags} = this.parse(RemovePgExtensionCommand)
    const addonName = flags.addon

    if (err instanceof HTTPError) {
      if (err.statusCode === 400) {
        this.error(
          `Extension ${pgExtensionColour(args.PG_EXTENSION)} still has dependent extensions. ` +
          'It can only be removed after its dependents are removed.')
      } else if (err.statusCode === 404) {
        this.error(err.body.reason)
      } else if (err.statusCode === 422) {
        this.error(`Add-on ${color.addon(addonName)} is not finished provisioning`)
      } else {
        this.error('Add-on service is temporarily unavailable. Try again later.')
      }
    } else {
      throw err
    }
  }
}
