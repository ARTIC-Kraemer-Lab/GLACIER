import React, { useEffect, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  LinearProgress,
  Paper,
  Typography
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { JsonForms } from '@jsonforms/react';
import { buildUISchema } from '../Parameters/buildUISchema';
import { renderers } from '../Parameters/renderers';
import { API } from '../../services/api.js';
import { useTranslation } from 'react-i18next';

// Read-only view of the parameters (and execution profile) saved at launch.
// The values come straight from glacier-params.json, so no validation or default
// injection is applied: what was passed to Nextflow is what is shown.
export default function LaunchedParameters({ instance, showHiddenParams }) {
  const { t } = useTranslation();
  const [params, setParams] = useState<Record<string, unknown> | null>(null);
  const [schema, setSchema] = useState<Record<string, unknown> | null>(null);
  const [profile, setProfile] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;

    const fetchParameters = async () => {
      setLoading(true);
      const [paramsResult, schemaResult, profileResult] = await Promise.all([
        API.getWorkflowInstanceParams(instance),
        API.getWorkflowSchema(instance.workflow_version.path),
        API.getWorkflowInstanceProfile(instance)
      ]);
      if (cancelled) return;
      setParams(paramsResult.ok && paramsResult.data ? paramsResult.data : {});
      setSchema(schemaResult.ok && schemaResult.data ? schemaResult.data : null);
      setProfile(profileResult.ok && profileResult.data ? profileResult.data : null);
      setLoading(false);
    };

    fetchParameters();
    return () => {
      cancelled = true;
    };
  }, [instance]);

  const isEmpty = !params || Object.keys(params).length === 0;
  const uischema = schema ? buildUISchema(schema, { showHidden: showHiddenParams }) : null;

  return (
    <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', p: 2 }}>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography
          id="monitor-parameters-profile"
          variant="body2"
          color="text.secondary"
          sx={{ mb: 2 }}
        >
          {t('monitor.parameters.execution-profile')}:{' '}
          <Typography component="span" variant="body2" color="text.primary">
            {profile ?? t('monitor.parameters.not-recorded')}
          </Typography>
        </Typography>

        {loading ? (
          <Box>
            <LinearProgress />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {t('monitor.parameters.loading')}
            </Typography>
          </Box>
        ) : isEmpty ? (
          <Typography>{t('monitor.parameters.none')}</Typography>
        ) : schema && uischema ? (
          <JsonForms
            readonly
            schema={schema}
            uischema={uischema}
            data={params}
            renderers={renderers}
          />
        ) : (
          <>
            <Alert severity="info" sx={{ mb: 2 }}>
              {t('monitor.parameters.no-schema')}
            </Alert>
            <Box
              component="pre"
              sx={{
                m: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontFamily: 'monospace',
                fontSize: 12
              }}
            >
              {JSON.stringify(params, null, 2)}
            </Box>
          </>
        )}

        {!loading && !isEmpty && schema && uischema && (
          <Accordion disableGutters sx={{ mt: 2 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="body2">{t('monitor.parameters.raw-json')}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box
                component="pre"
                sx={{
                  m: 0,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  fontFamily: 'monospace',
                  fontSize: 12
                }}
              >
                {JSON.stringify(params, null, 2)}
              </Box>
            </AccordionDetails>
          </Accordion>
        )}
      </Paper>
    </Box>
  );
}
