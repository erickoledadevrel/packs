# BigQuery Pack

This BigQuery Pack can't be published to the Coda gallery due to Google's policies around sensitive scopes. Although it's possible to request Google Cloud scopes during the OAuth flow, Google won't approve those scopes for a public project. Therefore to use this Pack you must deploy your own copy of it with your own OAuth credentials.

## Setup

### Pack

1.  Clone this repository.

    ```sh
    git clone https://github.com/erickoledadevrel/packs.git
    ```

1.  Install the dependencies.

    ```sh
    npm install
    ```

1.  Register an API token.

    ```sh
    npx coda register
    ```

1.  Create the Pack.

    ```sh
    npx coda create bigquery/pack.ts --name "BigQuery"
    ```

1.  Upload the Pack.

    ```
    npx coda upload bigquery/pack.ts
    ```

### OAuth

1.  Open the Pack in the Pack Studio and navigate to the **Settings** tab.
1.  Click **Add OAuth credentials**.
1.  Copy the value shown for **Redirect URL**.
1.  In a new tab, open the [Google Cloud Console](https://console.cloud.google.com/).
1.  Create or select a project to use with the Pack.
1.  Navigate to **APIs & Services > OAuth consent screen**.
1.  Select the **User Type** value **Internal**, and click **Create**.

    If you aren't part of a Google Workspace organization you must select **External**. You should keep the project in **Testing** mode, and add yourself as a test user.

1.  Enter a value for all required fields and click **Save and continue**.
1.  Click **Add or remove scopes**, and under **Manually add scopes** enter the following:

    ```
    profile
    https://www.googleapis.com/auth/bigquery.readonly
    https://www.googleapis.com/auth/cloudplatformprojects.readonly
    ```

1.  Click **Add to table**, then **Update**, and finally **Save and continue**.
1.  Navigate to the **Credentials** tab.
1.  Click **+ Create Credentials > OAuth client ID**.
1.  For **Application type** select **Web application**.
1.  Under **Authorized redirect URIs** click **+ Add URI**.
1.  Paste the URL you copied earlier from the Pack Studio.
1.  Click the **Create** button.
1.  Copy the **Client ID** and **Client secret**.
1.  Back in the Pack Studio OAuth credentials dialog, paste the client ID and secret into the corresponding text boxes.
1.  Click **Save**.
