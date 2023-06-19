/*
|--------------------------------------------------------------------------
| Ally Oauth driver
|--------------------------------------------------------------------------
|
| This is a dummy implementation of the Oauth driver. Make sure you
|
| - Got through every line of code
| - Read every comment
|
*/

import type { AllyUserContract, ApiRequestContract } from '@ioc:Adonis/Addons/Ally'
import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import { Oauth2Driver, ApiRequest, RedirectRequest } from '@adonisjs/ally/build/standalone'

/**
 * Define the access token object properties in this type. It
 * must have "token" and "type" and you are free to add
 * more properties.
 */
export type SNCFAccessToken = {
  token: string
  type: 'bearer'

  access_token: string
  refresh_token: string
  scopes: string[]
  id_token: string
  expires_in: number
}

/**
 * Define a union of scopes your driver accepts. Here's an example of same
 * https://github.com/adonisjs/ally/blob/develop/adonis-typings/ally.ts#L236-L268
 *
 */
export type SNCFScopes =
  | 'activity'
  | 'address'
  | 'company'
  | 'department'
  | 'email'
  | 'facility'
  | 'manager'
  | 'occupation'
  | 'openid'
  | 'other'
  | 'profile'
  | 'service'

/**
 * Define the configuration options accepted by your driver. It must have the following
 * properties and you are free add more.
 */
export type SncfDriverConfig = {
  driver: 'sncf'
  clientId: string
  clientSecret: string
  callbackUrl: string
  env: 'prod' | 'rec' | 'dev'
  issuer?: string
  scopes?: SNCFScopes[]
}

/**
 * Driver implementation. It is mostly configuration driven except the user calls
 */
export class SncfDriverContract extends Oauth2Driver<SNCFAccessToken, SNCFScopes> {
  /**
   * The URL to hit to exchange the authorization code for the access token
   *
   * Do not define query strings in this URL.
   */
  protected accessTokenUrl = 'https://idp.sncf.fr/openam/oauth2/IDP/access_token'
  /**
   * The URL for the redirect request. The user will be redirected on this page
   * to authorize the request.
   *
   * Do not define query strings in this URL.
   */
  protected authorizeUrl = 'https://idp.sncf.fr/openam/oauth2/IDP/authorize'
  /**
   * The param name for the authorization code. Read the documentation of your oauth
   * provider and update the param name to match the query string field name in
   * which the oauth provider sends the authorization_code post redirect.
   */
  protected codeParamName = 'code'
  /**
   * The param name for the error. Read the documentation of your oauth provider and update
   * the param name to match the query string field name in which the oauth provider sends
   * the error post redirect
   */
  protected errorParamName = 'error'
  /**
   * Parameter name for sending the scopes to the oauth provider.
   */
  protected scopeParamName = 'scope'
  /**
   * The separator identifier for defining multiple scopes
   */
  protected scopesSeparator = ' '
  /**
   * Cookie name for storing the CSRF token. Make sure it is always unique. So a better
   * approach is to prefix the oauth provider name to `oauth_state` value. For example:
   * For example: "facebook_oauth_state"
   */
  protected stateCookieName = 'sncf_oauth_state'
  /**
   * Parameter name to be used for sending and receiving the state from.
   * Read the documentation of your oauth provider and update the param
   * name to match the query string used by the provider for exchanging
   * the state.
   */
  protected stateParamName = 'state'
  /**
   * The URL to hit to get the user details
   *
   * Do not define query strings in this URL.
   */
  protected userInfoUrl = 'https://idp.sncf.fr/openam/oauth2/IDP/userinfo'

  constructor(ctx: HttpContextContract, public config: SncfDriverConfig) {
    super(ctx, config)

    if (config.env === 'rec') {
      this.accessTokenUrl = this.accessTokenUrl.replace('idp.sncf.fr', 'idp-rec.sncf.fr:443')
      this.authorizeUrl = this.authorizeUrl.replace('idp.sncf.fr', 'idp-rec.sncf.fr:443')
      this.userInfoUrl = this.userInfoUrl.replace('idp.sncf.fr', 'idp-rec.sncf.fr:443')
    } else if (config.env === 'dev') {
      this.accessTokenUrl = this.accessTokenUrl.replace('idp.sncf.fr', 'idp-dev.sncf.fr:443')
      this.authorizeUrl = this.authorizeUrl.replace('idp.sncf.fr', 'idp-dev.sncf.fr:443')
      this.userInfoUrl = this.userInfoUrl.replace('idp.sncf.fr', 'idp-dev.sncf.fr:443')
    } else if (config.issuer) {
      // TODO
    }

    /**
     * Extremely important to call the following method to clear the
     * state set by the redirect request.
     *
     * DO NOT REMOVE THE FOLLOWING LINE
     */
    this.loadState()
  }

  /**
   * Optionally configure the access token request. The actual request is made by
   * the base implementation of "Oauth2" driver and this is a hook to pre-configure
   * the request
   */
  // protected configureAccessTokenRequest(request: ApiRequest) {}

  /**
   * Update the implementation to tell if the error received during redirect
   * means "ACCESS DENIED".
   */
  public accessDenied() {
    return this.ctx.request.input('error') === 'user_denied'
  }

  /**
   * Get the user details by query the provider API. This method must return
   * the access token and the user details both. Checkout the google
   * implementation for same.
   *
   * https://github.com/adonisjs/ally/blob/develop/src/Drivers/Google/index.ts#L191-L199
   */
  public async user(
    callback?: (request: ApiRequest) => void
  ): Promise<AllyUserContract<SNCFAccessToken>> {
    const token = await this.accessToken(callback)
    const user = await this.getUserInfo(token.token, callback)

    return {
      ...user,
      token: token,
    }
  }

  public async userFromToken(
    accessToken: string,
    callback?: (request: ApiRequest) => void
  ): Promise<AllyUserContract<{ token: string; type: 'bearer' }>> {
    const user = await this.getUserInfo(accessToken, callback)

    return {
      ...user,
      token: { token: accessToken, type: 'bearer' as const },
    }
  }

  protected override configureAccessTokenRequest(request: ApiRequestContract): void {
    request.header('Content-Type', 'application/x-www-form-urlencoded')
    request.header(
      'Authorization',
      `Basic ${Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString(
        'base64'
      )}`
    )
    // request.field('code') ??
    request.clearField('client_id')
    request.clearField('client_secret')
  }

  /**
   * Optionally configure the authorization redirect request. The actual request
   * is made by the base implementation of "Oauth2" driver and this is a
   * hook to pre-configure the request.
   */
  protected configureRedirectRequest(request: RedirectRequest<SNCFScopes>) {
    request.scopes(this.config.scopes || ['openid', 'email', 'profile'])
    request.param('response_type', 'code')
  }

  /**
   * Returns the HTTP request with the authorization header set
   */
  protected getAuthenticatedRequest(url: string, token: string) {
    const request = this.httpClient(url)
    request.header('Authorization', `Bearer ${token}`)
    request.header('Accept', 'application/json')
    request.parseAs('json')
    return request
  }

  /**
   * Fetches the user info from the FID API
   */
  protected async getUserInfo(
    token: string,
    callback?: (request: ApiRequestContract) => void
  ): Promise<{
    id: string
    nickName: string
    name: string
    email: string
    avatarUrl: null
    emailVerificationState: 'unsupported'
    original: any
  }> {
    const request = this.getAuthenticatedRequest(this.userInfoUrl, token)
    if (typeof callback === 'function') {
      callback(request)
    }

    const body = await request.get()

    return {
      id: body.sub,
      nickName: body.displayName ?? `${body.family_name} ${body.first_name}`,
      name: `${body.family_name} ${body.first_name}`,
      email: body.Mail,
      avatarUrl: null,
      emailVerificationState: 'unsupported',
      original: body,
    }
  }
}
