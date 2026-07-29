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
pub struct ShareVariant {
    pub text: String,
    pub file: ShareFile,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SharePromptRequest {
    pub title: String,
    pub variants: Vec<ShareVariant>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PendingShare {
    pub status: String,
    pub id: Option<String>,
    pub name: Option<String>,
    pub mime: Option<String>,
    pub contents: Option<String>,
    pub error: Option<String>,
}
