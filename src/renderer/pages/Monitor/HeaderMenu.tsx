import React from 'react';
import {
  Box,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions
} from '@mui/material';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { API } from '../../services/api.js';
import { WorkflowStatus } from '../../../types/types.js';
import { useTranslation } from 'react-i18next';

type ExecutionAction = 'cancel' | 'force-cancel' | 'resume' | 'restart';

const ACTION_LABEL: Record<ExecutionAction, string> = {
  cancel: 'monitor.execution.cancel',
  'force-cancel': 'monitor.execution.force-cancel',
  resume: 'monitor.execution.resume',
  restart: 'monitor.execution.restart'
};

const ACTION_CONFIRM: Record<ExecutionAction, string> = {
  cancel: 'monitor.execution.cancel-confirm',
  'force-cancel': 'monitor.execution.force-cancel-confirm',
  resume: 'monitor.execution.resume-confirm',
  restart: 'monitor.execution.restart-confirm'
};

export default function HeaderMenu({ instance, logMessage, onRestart, onRefresh }) {
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  // Set when a graceful cancel did not stop the run; the menu entry then offers
  // the force cancel fallback instead.
  const [stopFailed, setStopFailed] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  // Execution action awaiting confirmation in the in-app dialog. A native
  // window.confirm cannot be driven reliably by automation on every platform.
  const [pendingAction, setPendingAction] = React.useState<ExecutionAction | null>(null);
  // Held until the menu's exit transition completes, so focus moves cleanly
  // from the menu into the dialog.
  const [queuedAction, setQueuedAction] = React.useState<ExecutionAction | null>(null);

  React.useEffect(() => {
    setStopFailed(false);
    setBusy(false);
    setPendingAction(null);
    setQueuedAction(null);
  }, [instance.id]);

  const handleExecutionActionsMenuClose = () => {
    setAnchorEl(null);
  };

  const requestExecutionAction = (action: ExecutionAction) => {
    // Move focus out of the closing menu so it is never inside an aria-hidden
    // ancestor while the confirmation dialog takes over.
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    handleExecutionActionsMenuClose();
    setQueuedAction(action);
  };

  const handleExecutionActionsMenuExited = () => {
    if (queuedAction) {
      setPendingAction(queuedAction);
      setQueuedAction(null);
    }
  };

  const closeConfirm = () => {
    setPendingAction(null);
  };

  const performExecutionCancel = async () => {
    logMessage(`${t('monitor.execution.cancelling')}: ${instance.id}.`);
    setBusy(true);
    try {
      const result = await API.cancelWorkflowInstance(instance);
      if (!result.ok) {
        logMessage(`Cancel failed: ${result.error.message}`);
        setStopFailed(true);
        return;
      }
      if (result.data?.stopped === false) {
        setStopFailed(true);
        logMessage(t('monitor.execution.cancel-unconfirmed'));
        return;
      }
      setStopFailed(false);
      if (onRefresh) onRefresh();
    } finally {
      setBusy(false);
    }
  };

  const performExecutionForceCancel = async () => {
    logMessage(`${t('monitor.execution.force-cancelling')}: ${instance.id}.`);
    setBusy(true);
    try {
      const result = await API.killWorkflowInstance(instance);
      if (!result.ok) {
        logMessage(`Force cancel failed: ${result.error.message}`);
        return;
      }
      setStopFailed(false);
      if (onRefresh) onRefresh();
    } finally {
      setBusy(false);
    }
  };

  const performExecutionResume = async () => {
    const result = await API.runWorkflow(instance, {}, { resume: true });
    if (!result.ok) {
      logMessage(`Resume failed: ${result.error.message}`);
      return;
    }
    setStopFailed(false);
    logMessage(`${t('monitor.execution.resuming')}: ${instance.id}.`);
    if (onRefresh) onRefresh();
  };

  const performExecutionRestart = async () => {
    if (instance.status === WorkflowStatus.Running) {
      const result = await API.cancelWorkflowInstance(instance);
      if (!result.ok || result.data?.stopped === false) {
        setStopFailed(true);
        logMessage(t('monitor.execution.cancel-unconfirmed'));
        return;
      }
    }
    logMessage(`${t('monitor.execution.restarting')}: ${instance.id}.`);
    setStopFailed(false);
    if (onRestart) onRestart(instance.id);
  };

  const handleConfirm = () => {
    const action = pendingAction;
    if (!action) return;
    setPendingAction(null);
    switch (action) {
      case 'cancel':
        performExecutionCancel();
        break;
      case 'force-cancel':
        performExecutionForceCancel();
        break;
      case 'resume':
        performExecutionResume();
        break;
      case 'restart':
        performExecutionRestart();
        break;
    }
  };

  const handleOpenResultsFolder = () => {
    API.openResultsFolder(instance);
  };

  return (
    <Box display="flex" justifyContent="space-between" alignItems="center" p={2}>
      <Button
        id="execution-actions-button"
        aria-controls={anchorEl ? 'execution-actions' : undefined}
        aria-haspopup="true"
        aria-expanded={anchorEl ? 'true' : undefined}
        onClick={(event) => setAnchorEl(event.currentTarget)}
        variant="contained"
      >
        {t('monitor.execution.actions')}
      </Button>
      <Menu
        id="execution-actions"
        aria-labelledby="execution-actions-label"
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleExecutionActionsMenuClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        // Do not pull focus back to the actions button when the menu closes:
        // the confirmation dialog opens straight away and owns focus.
        disableRestoreFocus
        slotProps={{ transition: { onExited: handleExecutionActionsMenuExited } }}
      >
        {instance.status === WorkflowStatus.Running &&
          (stopFailed ? (
            <MenuItem
              id="execution-force-cancel"
              disabled={busy}
              onClick={() => requestExecutionAction('force-cancel')}
            >
              {t('monitor.execution.force-cancel')}
            </MenuItem>
          ) : (
            <MenuItem
              id="execution-cancel"
              disabled={busy}
              onClick={() => requestExecutionAction('cancel')}
            >
              {t('monitor.execution.cancel')}
            </MenuItem>
          ))}
        <MenuItem
          id="execution-resume"
          disabled={busy}
          onClick={() => requestExecutionAction('resume')}
        >
          {t('monitor.execution.resume')}
        </MenuItem>
        <MenuItem
          id="execution-restart"
          disabled={busy}
          onClick={() => requestExecutionAction('restart')}
        >
          {t('monitor.execution.restart')}
        </MenuItem>
      </Menu>

      <Dialog
        data-testid="execution-confirm-dialog"
        open={pendingAction !== null}
        onClose={closeConfirm}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{pendingAction ? t(ACTION_LABEL[pendingAction]) : ''}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {pendingAction ? t(ACTION_CONFIRM[pendingAction]) : ''}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button id="execution-confirm-dismiss" onClick={closeConfirm}>
            {t('common.cancel')}
          </Button>
          <Button
            id="execution-confirm-okay"
            variant="contained"
            color={pendingAction === 'force-cancel' ? 'error' : 'primary'}
            onClick={handleConfirm}
          >
            {t('monitor.execution.confirm')}
          </Button>
        </DialogActions>
      </Dialog>

      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          px: 2
        }}
      >
        <Typography variant="h6" sx={{ textAlign: 'center' }} data-testid="instance-name">
          {instance.name}
        </Typography>
        <Typography variant="subtitle1" sx={{ textAlign: 'center' }}>
          {instance.workflow_version.name}
        </Typography>
      </Box>

      <Button
        id="open-results-folder-button"
        onClick={() => handleOpenResultsFolder()}
        variant="contained"
      >
        {t('monitor.open-results-folder')}
      </Button>
    </Box>
  );
}
