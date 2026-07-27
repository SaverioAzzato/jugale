use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShareFile {
    pub name: String,
    pub mime: String,
    pub contents: String,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SharePromptRequest {
    pub title: String,
    pub text: String,
    pub files: Vec<ShareFile>,
}
