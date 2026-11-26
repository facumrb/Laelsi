import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OutputEmitterRef,
  signal,
  Signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ActivatedRoute,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  bootstrapBoxSeam,
  bootstrapShieldLock,
  bootstrapFilePerson,
} from '@ng-icons/bootstrap-icons';
import {
  catchError,
  combineLatest,
  EMPTY,
  map,
  startWith,
  Subject,
  switchMap,
  tap,
} from 'rxjs';
import { ApiClientService } from '@services/api-services/api-client.service';
import { ApiOrderService } from '@services/api-services/api-order.service';
import { AuthService } from '@services/auth.service';
import { IApiClient } from '@models/user.model';
import { IApiOrder } from '@models/order.model';

/*
Lo que esta página le pasa a cada pestaña al activarla (ver onActivate). Se describe con interfaces y no con
las clases de las pestañas: importarlas acá las sumaría a este archivo y dejarían de cargarse por separado.
*/
interface PestanaConPerfil {
  profile: Signal<IApiClient | null>;
}
interface PestanaDePedidos {
  orders: Signal<IApiOrder[]>;
  loading: Signal<boolean>;
  currentPage: Signal<number>;
  totalPages: Signal<number>;
  pageChange: OutputEmitterRef<number>;
}
interface PestanaQueActualiza {
  profileUpdated: OutputEmitterRef<void>;
}

@Component({
  selector: 'app-profile-page',
  imports: [NgIconComponent, RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  viewProviders: [
    provideIcons({
      bootstrapBoxSeam,
      bootstrapShieldLock,
      bootstrapFilePerson,
    }),
  ],
  templateUrl: './profile-page.component.html',
})
export class ProfilePageComponent {
  private authService = inject(AuthService);
  private apiClientService = inject(ApiClientService);
  private apiOrderService = inject(ApiOrderService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  currentUserSignal = this.authService.currentUser;

  // Perfil completo de la cuenta. Mientras llega por primera vez se muestra el spinner
  fullProfile = signal<IApiClient | null>(null);
  loading = signal(true);
  // No se pudo cargar el perfil: se ofrece reintentar en lugar de mostrar las pestañas vacías
  profileError = signal(false);

  // Pedidos de la página actual
  misPedidos = signal<IApiOrder[]>([]);
  currentPage = signal<number>(1);
  totalPages = signal<number>(1);
  loadingOrders = signal(true);

  private recargarPerfil = new Subject<void>();
  private recargarPedidos = new Subject<void>();

  constructor() {
    const id = this.currentUserSignal()?.id;
    if (!id) {
      this.loading.set(false);
      return;
    }

    // Perfil: switchMap descarta una respuesta vieja si se vuelve a pedir antes de que llegue
    this.recargarPerfil
      .pipe(
        switchMap(() =>
          this.apiClientService.getAccountInfoById(id).pipe(
            catchError(() => {
              // El errorInterceptor ya avisó. Sin un perfil cargado, las pestañas no tienen qué mostrar
              if (!this.fullProfile()) this.profileError.set(true);
              this.loading.set(false);
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((fullUser) => {
        this.fullProfile.set(fullUser);
        this.authService.updateCurrentUser(fullUser);
        this.profileError.set(false);
        this.loading.set(false);
      });

    // Pedidos: se piden de nuevo al cambiar la página de la URL o al recargar a mano.
    // switchMap descarta la respuesta de una página anterior que llegue tarde.
    combineLatest([
      this.route.queryParamMap.pipe(
        map((params) => Number(params.get('page')) || 1),
      ),
      this.recargarPedidos.pipe(startWith(undefined)),
    ])
      .pipe(
        tap(([page]) => {
          this.currentPage.set(page);
          this.loadingOrders.set(true);
        }),
        switchMap(([page]) =>
          this.apiOrderService.getOrdersByClient(id, page).pipe(
            catchError(() => {
              this.loadingOrders.set(false);
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((data) => {
        this.misPedidos.set(data.data);
        this.totalPages.set(data.totalPages);
        this.loadingOrders.set(false);
      });

    this.recargarPerfil.next();
  }

  // Vuelve a intentar la carga del perfil, con el spinner
  retryProfile(): void {
    this.profileError.set(false);
    this.loading.set(true);
    this.recargarPerfil.next();
  }

  // Vuelve a pedir el perfil y los pedidos (ej: después de cancelar un pedido o de editar los datos)
  private refresh(): void {
    this.recargarPerfil.next();
    this.recargarPedidos.next();
  }

  // Le pasa a la pestaña activa los datos que muestra y escucha sus avisos
  onActivate(pestana: object) {
    if (this.tienePerfil(pestana)) {
      pestana.profile = this.fullProfile;
    }
    if (this.esDePedidos(pestana)) {
      pestana.orders = this.misPedidos;
      pestana.loading = this.loadingOrders;
      pestana.currentPage = this.currentPage;
      pestana.totalPages = this.totalPages;
      pestana.pageChange.subscribe((page) => {
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { page },
          queryParamsHandling: 'merge',
        });
      });
    }
    if (this.actualiza(pestana)) {
      pestana.profileUpdated.subscribe(() => this.refresh());
    }
  }

  private tienePerfil(pestana: object): pestana is PestanaConPerfil {
    return 'profile' in pestana;
  }

  private esDePedidos(pestana: object): pestana is PestanaDePedidos {
    return 'orders' in pestana && 'pageChange' in pestana;
  }

  private actualiza(pestana: object): pestana is PestanaQueActualiza {
    return 'profileUpdated' in pestana;
  }
}
