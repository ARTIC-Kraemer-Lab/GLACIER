import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Container,
  Paper,
  Stack,
  Tabs,
  Tab,
  TextField,
  Typography,
  Button,
  Alert
} from '@mui/material';
import { JsonForms } from '@jsonforms/react';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import Avatar from '@mui/material/Avatar';
import NotStartedIcon from '@mui/icons-material/NotStarted';
import DeleteIcon from '@mui/icons-material/Delete';
import IconButton from '@mui/material/IconButton';
import Ajv, { ErrorObject } from 'ajv'; // ajv is also used by jsonforms
import { buildUISchema } from './buildUISchema';
import { renderers } from './renderers';
import { SettingsKey } from '../../../types/settings.js';
import { API } from '../../services/api.js';
import { useTranslation } from 'react-i18next';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const ajv = new Ajv({
  useDefaults: true, // populate all fields (if not provided)
  allErrors: true,
  strict: false
});

// add custom AJV formats
ajv.addFormat('file-path', {
  type: 'string',
  validate: (v: string) => typeof v === 'string' && v.length > 0
});
ajv.addFormat('directory-path', {
  type: 'string',
  validate: (v: string) => typeof v === 'string' && v.length > 0
});
ajv.addFormat('path', {
  type: 'string',
  validate: (v: string) => typeof v === 'string' && v.length > 0
});
function TabPanel({ children, value, index }) {
  return value === index ? <Box sx={{ p: 2, flexGrow: 1 }}>{children}</Box> : null;
}

export default function ParametersPage({ instance, refreshInstancesList, logMessage }) {
  const { t } = useTranslation();
  const default_profile = 'standard';

  const [disableSchemaValidation, setDisableSchemaValidation] = useState<boolean>(false);

  const [params, setParams] = useState<Record<string, unknown>>({});
  const [schema, setSchema] = useState<Record<string, unknown> | null>({});
  const [tabSelected, setTabSelected] = React.useState(0);
  const [readme, setReadme] = useState<string>('');

  const onLaunch = async (instance, params) => {
    // Strip out profile from params before sending to backend
    const call_params = { ...params };
    const profile = params['profile'] || default_profile;
    delete call_params['profile'];
    const id = await API.runWorkflow(instance, call_params, { profile: profile });
    logMessage(`Launched workflow ${instance.name}`);
    refreshInstancesList();
  };

  useEffect(() => {
    const getSettings = async () => {
      setDisableSchemaValidation(await API.settingsGet(SettingsKey.DisableSchemaValidation));
    };
    const get_available_profiles = async () => {
      const profiles = await API.getAvailableProfiles(instance);
      return profiles || [default_profile];
    };
    const get_schema = async (profiles: string[]) => {
      let schema = await API.getWorkflowSchema(instance.workflow_version.path);
      // Add profile selection to the a separate schema category
      if (profiles.length > 0) {
        if (!schema['properties']) {
          schema['properties'] = {};
        }
        schema['properties']['profile'] = {
          type: 'array',
          title: 'Execution Profile(s)',
          description: 'Select one or more execution profile to use',
          items: {
            type: 'string',
            enum: profiles
          },
          uniqueItems: true,
          default: profiles.includes(default_profile)
            ? [default_profile]
            : profiles.length > 0
              ? [profiles[0]]
              : []
        };
      }
      setSchema(schema);
    };
    const get_params = async () => {
      const data = await API.getWorkflowInstanceParams(instance);
      if (data) {
        setParams(data);
      }
    };
    const fetchReadme = async () => {
      const desc = await API.getWorkflowReadme(instance);
      setReadme(desc || '');
    };

    get_available_profiles().then((profiles) => {
      getSettings();
      get_schema(profiles);
      get_params();
      fetchReadme();
    });
  }, [instance]);

  // Read schema and compile with AJV
  const validate = useMemo(() => {
    if (disableSchemaValidation) {
      // no-op validator
      const fn: any = () => true;
      fn.errors = null;
      return fn;
    }
    return ajv.compile(schema);
  }, [schema]);

  // Build the UI schema with stepper options
  const uischema = buildUISchema(schema, { showHidden: false });
  (uischema as any).options = { variant: 'stepper', showNavButtons: true };

  const schemaErrors: ErrorObject[] | null = useMemo(() => {
    if (disableSchemaValidation) {
      return null;
    }

    try {
      validate(params);
      return validate.errors ?? null;
    } catch {
      return [{ instancePath: '', keyword: 'schema', message: 'Invalid schema' } as any];
    }
  }, [params, validate]);

  const isEmpty = (obj) => {
    return Object.keys(obj).length === 0;
  };

  const handleTabChange = (event, newValue) => {
    setTabSelected(newValue);
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Typography variant="h6">
          [{instance.name}] {instance.workflow_version.name}
        </Typography>
        <Button
          disabled={schemaErrors !== null}
          variant="contained"
          onClick={() => onLaunch(instance, params)}
        >
          {t('parameters.launch-workflow')}
        </Button>
      </Box>

      <Tabs value={tabSelected} onChange={handleTabChange}>
        <Tab label={t('parameters.info.title')} id="parameters-info-tab" />
        <Tab label={t('parameters.params.title')} id="parameters-params-tab" />
      </Tabs>

      <TabPanel value={tabSelected} index={0}>
        <Markdown remarkPlugins={[remarkGfm]}>{readme}</Markdown>
      </TabPanel>

      <TabPanel value={tabSelected} index={1}>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            {!isEmpty(schema) ? (
              <JsonForms
                schema={schema}
                uischema={uischema}
                data={params}
                renderers={renderers}
                onChange={({ data, errors }) => setParams(data)}
                ajv={disableSchemaValidation ? undefined : ajv}
              />
            ) : (
              <Typography>No parameters.</Typography>
            )}
          </Paper>
        </Stack>
      </TabPanel>
    </Box>
  );
}
